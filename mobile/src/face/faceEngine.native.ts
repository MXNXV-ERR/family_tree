// Face engine — NATIVE implementation (android/iOS). Uses the tfjs React Native
// backend (rn-webgl via expo-gl). Same BlazeFace + MobileNet pipeline as web.
//
// NOTE: tfjs-react-native requires a native runtime (expo-gl, expo-camera) — it
// does NOT run in Expo Go or on the web. Verify on an EAS dev build.
import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as blazeface from '@tensorflow-models/blazeface';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as FileSystem from 'expo-file-system/legacy';
import { l2normalize, type Descriptor, type Progress, type DetectedFaces } from './faceMatch';

let detector: blazeface.BlazeFaceModel | null = null;
let embedder: mobilenet.MobileNet | null = null;
let loading: Promise<void> | null = null;

export async function loadModels(onProgress?: (p: Progress) => void): Promise<void> {
  if (detector && embedder) return;
  if (loading) return loading;
  loading = (async () => {
    onProgress?.({ phase: 'models', fraction: 0.02, note: 'Starting engine' });
    // Lazy-require the RN backend so the web bundle never pulls native modules.
    await import('@tensorflow/tfjs-react-native');
    await tf.ready();
    onProgress?.({ phase: 'models', fraction: 0.06, note: 'Loading detector' });
    detector = await blazeface.load();
    onProgress?.({ phase: 'models', fraction: 0.13, note: 'Loading recognizer' });
    embedder = await mobilenet.load({ version: 2, alpha: 1.0 });
    onProgress?.({ phase: 'models', fraction: 0.18, note: 'Engine ready' });
  })();
  return loading;
}

async function uriToTensor(uri: string): Promise<tf.Tensor3D> {
  let b64: string;
  if (uri.startsWith('data:')) {
    b64 = uri.split(',')[1];
  } else {
    b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  }
  const raw = tf.util.encodeString(b64, 'base64').buffer;
  return decodeJpeg(new Uint8Array(raw)) as tf.Tensor3D;
}

export async function describeFromUri(uri: string): Promise<Descriptor | null> {
  if (!detector || !embedder) await loadModels();
  const pixels = await uriToTensor(uri);
  try {
    const faces = await detector!.estimateFaces(pixels, false);
    let face: tf.Tensor3D = pixels;
    let cropped: tf.Tensor3D | null = null;
    if (faces.length > 0) {
      const [x1, y1] = faces[0].topLeft as [number, number];
      const [x2, y2] = faces[0].bottomRight as [number, number];
      const h = pixels.shape[0], w = pixels.shape[1];
      const top = Math.max(0, Math.floor(y1)), left = Math.max(0, Math.floor(x1));
      const bh = Math.min(h - top, Math.ceil(y2 - y1)), bw = Math.min(w - left, Math.ceil(x2 - x1));
      if (bh > 8 && bw > 8) {
        cropped = tf.slice(pixels, [top, left, 0], [bh, bw, 3]);
        face = cropped;
      }
    }
    const emb = tf.tidy(() => embedder!.infer(face, true) as tf.Tensor);
    const data = Array.from(await emb.data());
    emb.dispose();
    cropped?.dispose();
    return l2normalize(data);
  } finally {
    pixels.dispose();
  }
}

// Cheap liveness check for the live loop — BlazeFace detection only, no embedding.
export async function detectFace(uri: string): Promise<boolean> {
  if (!detector) await loadModels();
  const pixels = await uriToTensor(uri);
  try {
    const faces = await detector!.estimateFaces(pixels, false);
    return faces.length > 0;
  } finally {
    pixels.dispose();
  }
}

// Detect ALL faces in an image → boxes in source pixels (+ image dims). Used by
// the family group-photo flow to crop each face out and assign it to a member.
export async function detectFaces(uri: string): Promise<DetectedFaces> {
  if (!detector) await loadModels();
  const pixels = await uriToTensor(uri);
  try {
    const found = await detector!.estimateFaces(pixels, false);
    const W = pixels.shape[1], H = pixels.shape[0];
    const faces = found
      .map((f) => {
        const [x1, y1] = f.topLeft as [number, number];
        const [x2, y2] = f.bottomRight as [number, number];
        const x = Math.max(0, Math.floor(x1)), y = Math.max(0, Math.floor(y1));
        return { x, y, w: Math.ceil(x2 - x1), h: Math.ceil(y2 - y1) };
      })
      .filter((b) => b.w > 8 && b.h > 8);
    return { width: W, height: H, faces };
  } finally {
    pixels.dispose();
  }
}

export const hasFaceModels = () => !!(detector && embedder);

// Face engine — WEB implementation. Runs in the browser via tfjs WebGL backend.
// BlazeFace locates the face; MobileNet's penultimate activation is the identity
// descriptor (pragmatic, fully cross-platform — not as sharp as FaceNet but good
// enough to rank a family set, and it loads from CDN so the web path is real).
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as blazeface from '@tensorflow-models/blazeface';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { l2normalize, type Descriptor, type Progress } from './faceMatch';

let detector: blazeface.BlazeFaceModel | null = null;
let embedder: mobilenet.MobileNet | null = null;
let loading: Promise<void> | null = null;

export async function loadModels(onProgress?: (p: Progress) => void): Promise<void> {
  if (detector && embedder) return;
  if (loading) return loading;
  loading = (async () => {
    onProgress?.({ phase: 'models', fraction: 0.02, note: 'Starting engine' });
    await tf.setBackend('webgl');
    await tf.ready();
    onProgress?.({ phase: 'models', fraction: 0.06, note: 'Loading detector' });
    detector = await blazeface.load();
    onProgress?.({ phase: 'models', fraction: 0.13, note: 'Loading recognizer' });
    embedder = await mobilenet.load({ version: 2, alpha: 1.0 });
    onProgress?.({ phase: 'models', fraction: 0.18, note: 'Engine ready' });
  })();
  return loading;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = uri;
  });
}

// Extract an L2-normalised descriptor from an image URI (data: or http).
// Returns null if no face is detected.
export async function describeFromUri(uri: string): Promise<Descriptor | null> {
  if (!detector || !embedder) await loadModels();
  const img = await loadImage(uri);
  const pixels = tf.browser.fromPixels(img);
  try {
    const faces = await detector!.estimateFaces(pixels, false);
    let face = pixels;
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
    const emb = tf.tidy(() => embedder!.infer(face as tf.Tensor3D, true) as tf.Tensor);
    const data = Array.from(await emb.data());
    emb.dispose();
    cropped?.dispose();
    return l2normalize(data);
  } finally {
    pixels.dispose();
  }
}

export const hasFaceModels = () => !!(detector && embedder);

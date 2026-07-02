// Face engine — WEB implementation. Uses @vladmandic/face-api (tfjs WebGL):
// SSD-MobileNet detector → 68-pt landmarks → aligned 128-D ResNet face descriptor.
// This is a real face-recognition embedding (far sharper at telling people apart
// than the old MobileNet-classifier features), and the landmark alignment is done
// inside withFaceDescriptor(). Models load from the jsDelivr CDN.
import * as faceapi from '@vladmandic/face-api';
import { l2normalize, type Descriptor, type Progress, type DetectedFaces } from './faceMatch';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
// Lower than the 0.5 default so faint/side faces in a group photo are still found.
const detectorOpts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });

let loaded = false;
let loading: Promise<void> | null = null;

export async function loadModels(onProgress?: (p: Progress) => void): Promise<void> {
  if (loaded) return;
  if (loading) return loading;
  loading = (async () => {
    onProgress?.({ phase: 'models', fraction: 0.02, note: 'Starting engine' });
    const tf = faceapi.tf as any; // face-api bundles its own tfjs; d.ts under-types it
    await tf.setBackend('webgl');
    await tf.ready();
    onProgress?.({ phase: 'models', fraction: 0.06, note: 'Loading detector' });
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    onProgress?.({ phase: 'models', fraction: 0.13, note: 'Loading recognizer' });
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    loaded = true;
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

// L2-normalised 128-D descriptor for the most prominent face. null if none.
export async function describeFromUri(uri: string): Promise<Descriptor | null> {
  if (!loaded) await loadModels();
  const img = await loadImage(uri);
  const det = await faceapi.detectSingleFace(img, detectorOpts).withFaceLandmarks().withFaceDescriptor();
  if (!det?.descriptor) return null;
  return l2normalize(Array.from(det.descriptor));
}

// Cheap liveness check for the live loop — detection only, no embedding.
export async function detectFace(uri: string): Promise<boolean> {
  if (!loaded) await loadModels();
  const img = await loadImage(uri);
  const det = await faceapi.detectSingleFace(img, detectorOpts);
  return !!det;
}

// Detect ALL faces → boxes in source pixels (+ image dims) for the group-photo flow.
export async function detectFaces(uri: string): Promise<DetectedFaces> {
  if (!loaded) await loadModels();
  const img = await loadImage(uri);
  const results = await faceapi.detectAllFaces(img, detectorOpts);
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const faces = results
    .map((r) => {
      const b = r.box;
      const x = Math.max(0, Math.floor(b.x)), y = Math.max(0, Math.floor(b.y));
      return { x, y, w: Math.ceil(b.width), h: Math.ceil(b.height) };
    })
    .filter((b) => b.w > 8 && b.h > 8);
  return { width: W, height: H, faces };
}

export const hasFaceModels = () => loaded;

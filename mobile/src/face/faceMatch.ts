// Shared face-match logic (platform-agnostic): descriptor matching + an
// AsyncStorage cache of member descriptors so repeat scans don't recompute
// (the "optimize" in the brief). The actual model inference lives in the
// platform-split faceEngine.web.ts / faceEngine.native.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Member } from '../shared/types';

export type Descriptor = number[]; // L2-normalised embedding

export interface MatchResult {
  member: Member;
  score: number; // cosine similarity in [-1, 1]; higher = closer
}

// A face bounding box in source-image pixels.
export interface FaceRegion { x: number; y: number; w: number; h: number }
// Result of detecting ALL faces in one image (for the family group photo).
export interface DetectedFaces { width: number; height: number; faces: FaceRegion[] }

export type Phase = 'models' | 'members' | 'analyze' | 'match' | 'done';
export interface Progress {
  phase: Phase;
  fraction: number; // 0..1 overall
  note?: string;
}

// Cosine similarity of two L2-normalised vectors == dot product.
export function similarity(a: Descriptor, b: Descriptor): number {
  if (a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function l2normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

export function rank(query: Descriptor, members: { member: Member; desc: Descriptor }[]): MatchResult[] {
  return members
    .map(({ member, desc }) => ({ member, score: similarity(query, desc) }))
    .sort((a, b) => b.score - a.score);
}

// ---- descriptor cache (optimize) ----
const djb2 = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
// v2: the web engine now produces 128-D face-api descriptors (was 1024-D MobileNet);
// the version segment invalidates any stale cached vectors of the old dimensions.
const keyFor = (m: Member) => `ft.face.v2.${m.id}.${djb2(m.photoUrl ?? '')}`;

export async function getCached(m: Member): Promise<Descriptor | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(m));
    return raw ? (JSON.parse(raw) as Descriptor) : null;
  } catch {
    return null;
  }
}

export async function putCached(m: Member, desc: Descriptor): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(m), JSON.stringify(desc));
  } catch {
    /* non-fatal */
  }
}

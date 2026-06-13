// Orchestrates a full face match with real progress: load models → build (and
// cache) member descriptors → analyse the query → rank. Imports the platform
// engine via './faceEngine' (web or native build).
import { loadModels, describeFromUri } from './faceEngine';
import { getCached, putCached, rank, type Descriptor, type MatchResult, type Progress } from './faceMatch';
import type { Member } from '../shared/types';

let memberCache: { member: Member; desc: Descriptor }[] | null = null;
let memberCacheKey = '';

const keyOf = (ms: Member[]) => ms.map((m) => `${m.id}:${(m.photoUrl ?? '').length}`).join('|');

// Build descriptors for every member that has a photo, using the persistent
// cache so unchanged photos are never re-analysed (the "optimize").
export async function buildMemberDescriptors(
  members: Member[],
  onProgress?: (p: Progress) => void,
): Promise<{ member: Member; desc: Descriptor }[]> {
  const withPhoto = members.filter((m) => m.photoUrl);
  const key = keyOf(withPhoto);
  if (memberCache && memberCacheKey === key) return memberCache;

  await loadModels(onProgress);
  const out: { member: Member; desc: Descriptor }[] = [];
  for (let i = 0; i < withPhoto.length; i++) {
    const m = withPhoto[i];
    let desc = await getCached(m);
    if (!desc) {
      try {
        desc = await describeFromUri(m.photoUrl!);
        if (desc) await putCached(m, desc);
      } catch {
        desc = null;
      }
    }
    if (desc) out.push({ member: m, desc });
    onProgress?.({ phase: 'members', fraction: 0.18 + 0.55 * ((i + 1) / Math.max(1, withPhoto.length)), note: `Indexing ${i + 1}/${withPhoto.length}` });
  }
  memberCache = out;
  memberCacheKey = key;
  return out;
}

export function clearMemberDescriptors() {
  memberCache = null;
  memberCacheKey = '';
}

// Full one-shot match for a captured/picked image.
export async function matchImage(
  queryUri: string,
  members: Member[],
  onProgress?: (p: Progress) => void,
): Promise<{ results: MatchResult[]; faceFound: boolean }> {
  const db = await buildMemberDescriptors(members, onProgress);
  onProgress?.({ phase: 'analyze', fraction: 0.78, note: 'Analysing face' });
  const q = await describeFromUri(queryUri);
  if (!q) {
    onProgress?.({ phase: 'done', fraction: 1, note: 'No face found' });
    return { results: [], faceFound: false };
  }
  onProgress?.({ phase: 'match', fraction: 0.92, note: 'Comparing' });
  const results = rank(q, db);
  onProgress?.({ phase: 'done', fraction: 1, note: 'Done' });
  return { results, faceFound: true };
}

// Lightweight match for the live camera: descriptors must be prebuilt.
export async function matchPrebuilt(queryUri: string, db: { member: Member; desc: Descriptor }[]): Promise<MatchResult[]> {
  const q = await describeFromUri(queryUri).catch(() => null);
  if (!q) return [];
  return rank(q, db);
}

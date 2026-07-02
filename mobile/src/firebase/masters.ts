// Master families — a virtual overlay that combines several trees the user
// belongs to into ONE browsable super-tree, without copying data. A master doc
// stores only the constituent treeIds + the cross-family "bridge" edges. Owner-
// private in v1 (the creator owns it; others build their own).
//
//   masters/{masterId}                ← { name, ownerUid, color, memberTreeIds[], links[] }
//   users/{uid}/masters/{masterId}    ← denormalised switcher index
//
// The combined view namespaces every member id as `${treeId}:${localId}`, so an
// edit made in the master view (see app/master.tsx) routes back to the origin
// tree via splitId(). A 'same' bridge collapses two records of one person.
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { subscribeMembers, subscribeRelationships } from './firestore';
import { FAMILY_COLORS, colorForIndex } from './families';
import type { Member, Relationship, BridgeLink, MasterFamily, MasterIndex } from '../shared/types';

const SEP = ':';
export const nsId = (treeId: string, localId: string) => `${treeId}${SEP}${localId}`;
// Split a namespaced id back into { treeId, localId }; null for a plain
// (single-tree) id, so the profile/member routes can tell a master edit apart.
export function splitId(id: string): { treeId: string; localId: string } | null {
  const i = id.indexOf(SEP);
  if (i < 0) return null;
  return { treeId: id.slice(0, i), localId: id.slice(i + 1) };
}

const mastersCol = () => collection(db, 'masters');
const masterDoc = (id: string) => doc(db, 'masters', id);
const masterIndexCol = (uid: string) => collection(db, 'users', uid, 'masters');
const masterIndexDoc = (uid: string, id: string) => doc(db, 'users', uid, 'masters', id);

const rid = () => Math.random().toString(36).slice(2, 10);
// Canonical signature of a family set — order-independent, so two masters over
// the same families collide regardless of pick order (blocks duplicate combos).
export const treeSig = (ids: string[]) => [...ids].sort().join('|');

// ---- CRUD ----

export async function createMaster(
  uid: string,
  input: { name: string; memberTreeIds: string[]; links?: BridgeLink[]; colorIndex?: number },
): Promise<string> {
  const ref = doc(mastersCol());
  const color = colorForIndex(input.colorIndex ?? Math.floor(Math.random() * FAMILY_COLORS.length));
  const name = input.name.trim() || 'Combined family';
  await setDoc(ref, {
    name, ownerUid: uid, color,
    memberTreeIds: input.memberTreeIds,
    links: input.links ?? [],
    createdAt: serverTimestamp(),
  });
  await setDoc(masterIndexDoc(uid, ref.id), {
    masterId: ref.id, name, color, treeCount: input.memberTreeIds.length, sig: treeSig(input.memberTreeIds),
  } as MasterIndex);
  return ref.id;
}

export async function updateMaster(uid: string, id: string, data: Partial<MasterFamily>) {
  await updateDoc(masterDoc(id), data as Record<string, unknown>);
  const patch: Partial<MasterIndex> = {};
  if (data.name) patch.name = data.name;
  if (data.color) patch.color = data.color;
  if (data.memberTreeIds) { patch.treeCount = data.memberTreeIds.length; patch.sig = treeSig(data.memberTreeIds); }
  if (Object.keys(patch).length) await setDoc(masterIndexDoc(uid, id), patch, { merge: true });
}

export async function addBridge(id: string, link: Omit<BridgeLink, 'id'>, existing: BridgeLink[]) {
  await updateDoc(masterDoc(id), { links: [...existing, { ...link, id: rid() }] });
}
export async function removeBridge(id: string, linkId: string, existing: BridgeLink[]) {
  await updateDoc(masterDoc(id), { links: existing.filter((l) => l.id !== linkId) });
}

export async function deleteMaster(uid: string, id: string) {
  await deleteDoc(masterIndexDoc(uid, id)).catch(() => {});
  await deleteDoc(masterDoc(id));
}

// ---- subscriptions ----

export const subscribeMyMasters = (uid: string, cb: (m: MasterIndex[]) => void) =>
  onSnapshot(masterIndexCol(uid),
    (snap) => cb(snap.docs.map((d) => ({ masterId: d.id, ...(d.data() as Omit<MasterIndex, 'masterId'>) }))),
    (e) => { console.warn('subscribeMyMasters', (e as { message?: string })?.message ?? e); cb([]); });

export const subscribeMaster = (id: string, cb: (m: MasterFamily | null) => void) =>
  onSnapshot(masterDoc(id),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<MasterFamily, 'id'>) }) : null),
    (e) => { console.warn('subscribeMaster', (e as { message?: string })?.message ?? e); cb(null); });

// Re-export the per-tree subscriptions so the hook has a single import surface.
export { subscribeMembers, subscribeRelationships };

// ---- combine helpers ----

// One-shot fetch of a tree's members (for the combine panel's duplicate scan).
export async function fetchTreeMembers(treeId: string): Promise<Member[]> {
  const snap = await getDocs(collection(db, 'trees', treeId, 'members'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Member, 'id'>) }));
}

// Suggest 'same person' bridges across the chosen trees by matching on name
// (+ birthDate when both records carry one). Same name with DIFFERENT birth
// dates is treated as two different people (no suggestion). The panel lets the
// user accept these as 'same' bridges (or change the type).
export interface BridgeSuggestion {
  aTreeId: string; aMember: Member; bTreeId: string; bMember: Member; reason: string;
}
export function suggestBridges(trees: { treeId: string; members: Member[] }[]): BridgeSuggestion[] {
  const norm = (s?: string) => (s ?? '').trim().toLowerCase();
  const out: BridgeSuggestion[] = [];
  for (let i = 0; i < trees.length; i++) {
    for (let j = i + 1; j < trees.length; j++) {
      for (const a of trees[i].members) {
        for (const b of trees[j].members) {
          if (!norm(a.name) || norm(a.name) !== norm(b.name)) continue;
          const bothDob = !!a.birthDate && !!b.birthDate;
          if (bothDob && a.birthDate !== b.birthDate) continue; // same name, different DOB
          out.push({
            aTreeId: trees[i].treeId, aMember: a, bTreeId: trees[j].treeId, bMember: b,
            reason: bothDob ? 'Same name & birth date' : 'Same name',
          });
        }
      }
    }
  }
  return out;
}

// ---- the union (pure) ----

export interface MasterTreeInput { treeId: string; members: Member[]; relationships: Relationship[]; }

// Combine several trees + bridge links into one {members, relationships} graph
// with namespaced ids. 'same' bridges collapse duplicate records into a single
// canonical node (union-find); 'spouse'/'parent' bridges add synthetic edges.
export function buildMasterData(
  trees: MasterTreeInput[], links: BridgeLink[],
): { members: Member[]; relationships: Relationship[] } {
  // canonical id resolution for 'same' bridges (b collapses into a).
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let x = id;
    while (parent.has(x)) x = parent.get(x)!;
    return x;
  };
  for (const l of links) {
    if (l.type !== 'same') continue;
    const ra = find(nsId(l.aTreeId, l.aMemberId));
    const rb = find(nsId(l.bTreeId, l.bMemberId));
    if (ra !== rb) parent.set(rb, ra);
  }

  const members: Member[] = [];
  const seen = new Set<string>();
  for (const t of trees) {
    for (const m of t.members) {
      const gid = find(nsId(t.treeId, m.id));
      if (seen.has(gid)) continue;      // keep the first (canonical) record's data
      seen.add(gid);
      members.push({ ...m, id: gid });
    }
  }

  const relationships: Relationship[] = [];
  const edgeSig = new Set<string>();
  const push = (fromRaw: string, toRaw: string, type: Relationship['type'], extra?: Partial<Relationship>) => {
    const f = find(fromRaw), to = find(toRaw);
    if (f === to) return;
    const sig = `${f}|${to}|${type}`;
    if (edgeSig.has(sig)) return;
    edgeSig.add(sig);
    const edge: Relationship = { id: `m:${sig}`, fromId: f, toId: to, type };
    if (extra?.status) edge.status = extra.status;
    if (extra?.marriageDate) edge.marriageDate = extra.marriageDate;
    relationships.push(edge);
  };
  for (const t of trees)
    for (const r of t.relationships)
      push(nsId(t.treeId, r.fromId), nsId(t.treeId, r.toId), r.type, { status: r.status, marriageDate: r.marriageDate });
  for (const l of links) {
    if (l.type === 'same') continue;
    const a = nsId(l.aTreeId, l.aMemberId);
    const b = nsId(l.bTreeId, l.bMemberId);
    if (l.type === 'spouse') {
      push(a, b, 'spouse', { status: l.status });
      push(b, a, 'spouse', { status: l.status });
    } else {
      push(a, b, 'parent'); // a = child, b = parent
    }
  }
  return { members, relationships };
}

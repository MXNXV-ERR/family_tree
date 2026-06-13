// Multi-family membership layer (full restructure).
//
// Firestore shape:
//   trees/{treeId}                       ← FamilyTree metadata (ownerUid, name, …)
//   trees/{treeId}/members|relationships ← unchanged tree data
//   trees/{treeId}/memberships/{uid}     ← who belongs + role (collaborators)
//   users/{uid}/families/{treeId}        ← per-user index for the switcher
//
// The legacy single tree keeps treeId === ownerUid, so existing data and the
// old security rules continue to work. New families use generated treeIds and
// need the membership-aware rules in mobile/firestore.rules.
import {
  collection, doc, setDoc, addDoc, updateDoc, getDoc, getDocs,
  onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { FamilyTree, Membership, Collaborator, FamilyRole } from '../shared/types';

export const FAMILY_COLORS = ['#8f8bff', '#ff8caf', '#5fd0b0', '#e0b873', '#6fb1ff', '#b1a6ff'];
export const colorForIndex = (i: number) => FAMILY_COLORS[i % FAMILY_COLORS.length];
export const monoOf = (name: string) => (name.trim()[0] || 'F').toUpperCase();

const rand = (n: number) => Array.from({ length: n }, () => '0123456789ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random() * 33)]).join('');
const genInvite = (surname?: string) => `${(surname || 'FAMILY').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'FAMILY'}-${rand(4)}`;

const familyIndexCol = (uid: string) => collection(db, 'users', uid, 'families');
const familyIndexDoc = (uid: string, treeId: string) => doc(db, 'users', uid, 'families', treeId);
const treeDoc = (treeId: string) => doc(db, 'trees', treeId);
const membershipDoc = (treeId: string, uid: string) => doc(db, 'trees', treeId, 'memberships', uid);

// Live list of the families a user belongs to (one listener, denormalised).
// Degrades to an empty list if the membership-aware rules aren't deployed yet,
// so the app still loads the user's primary (treeId === uid) tree.
export const subscribeMyFamilies = (uid: string, cb: (f: Membership[]) => void) =>
  onSnapshot(
    familyIndexCol(uid),
    (snap) => cb(snap.docs.map((d) => ({ treeId: d.id, ...(d.data() as Omit<Membership, 'treeId'>) }))),
    (e) => { console.warn('subscribeMyFamilies', e?.message ?? e); cb([]); },
  );

// Backfill: guarantee the user's own primary tree (treeId === uid) is registered
// as a family so the switcher always has at least one entry. Idempotent.
export async function ensurePrimaryFamily(uid: string, email?: string | null) {
  const idxRef = familyIndexDoc(uid, uid);
  const idxSnap = await getDoc(idxRef);
  if (idxSnap.exists()) return;

  const treeRef = treeDoc(uid);
  const treeSnap = await getDoc(treeRef);
  const existing = treeSnap.exists() ? (treeSnap.data() as any) : {};
  const name: string = existing.name || 'My Family';
  const mono = monoOf(name);
  const color = FAMILY_COLORS[0];

  // Ensure the tree doc carries the new metadata fields without clobbering data.
  await setDoc(treeRef, {
    name, mono, color, ownerUid: uid,
    inviteCode: existing.inviteCode || genInvite(name),
    kind: existing.kind || 'Your family',
    createdAt: existing.createdAt || serverTimestamp(),
  }, { merge: true });

  await setDoc(membershipDoc(uid, uid), { uid, email: email || '', role: 'owner', joinedAt: serverTimestamp() }, { merge: true });
  await setDoc(idxRef, { treeId: uid, role: 'owner', name, mono, color } as Membership);
}

// Create a brand-new family the user owns. Seeds the creator as the "you" node.
export async function createFamily(
  uid: string,
  email: string | null | undefined,
  input: { name: string; surname?: string; region?: string; summary?: string; colorIndex?: number; meName?: string },
): Promise<string> {
  const name = input.name.trim() || 'New Family';
  const mono = monoOf(name);
  const color = colorForIndex(input.colorIndex ?? Math.floor(Math.random() * FAMILY_COLORS.length));
  const treeRef = doc(collection(db, 'trees'));
  const treeId = treeRef.id;

  await setDoc(treeRef, {
    name, mono, color, ownerUid: uid,
    surname: input.surname || name.split(/\s+/)[0],
    region: input.region || '',
    summary: input.summary || '',
    kind: 'Your family',
    established: String(new Date().getFullYear()),
    inviteCode: genInvite(input.surname || name),
    createdAt: serverTimestamp(),
  });

  await setDoc(membershipDoc(treeId, uid), { uid, email: email || '', role: 'owner', joinedAt: serverTimestamp() });
  await setDoc(familyIndexDoc(uid, treeId), { treeId, role: 'owner', name, mono, color } as Membership);

  // Seed the creator so the new tree isn't empty and "You" resolves.
  await addDoc(collection(treeRef, 'members'), {
    name: input.meName || (email ? email.split('@')[0] : 'Me'),
    gender: 'other', associatedUserId: uid, createdAt: serverTimestamp(),
  });

  return treeId;
}

// Join an existing family by its invite code. Returns the treeId, or null.
export async function joinFamilyByInvite(uid: string, email: string | null | undefined, code: string): Promise<string | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const q = query(collection(db, 'trees'), where('inviteCode', '==', trimmed));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const t = snap.docs[0];
  const data = t.data() as any;
  const treeId = t.id;
  const role: FamilyRole = 'editor';

  await setDoc(membershipDoc(treeId, uid), { uid, email: email || '', role, joinedAt: serverTimestamp() }, { merge: true });
  await setDoc(familyIndexDoc(uid, treeId), {
    treeId, role, name: data.name || 'Family', mono: data.mono || monoOf(data.name || 'F'), color: data.color || FAMILY_COLORS[0],
  } as Membership);
  return treeId;
}

// Edit family metadata (owner). Also syncs the caller's switcher index basics.
export async function updateFamily(treeId: string, uid: string, data: Partial<FamilyTree>) {
  await updateDoc(treeDoc(treeId), data as any);
  const idxPatch: any = {};
  if (data.name) { idxPatch.name = data.name; idxPatch.mono = monoOf(data.name); }
  if (data.color) idxPatch.color = data.color;
  if (Object.keys(idxPatch).length) await setDoc(familyIndexDoc(uid, treeId), idxPatch, { merge: true });
}

// Live full metadata for one family (region/summary/invite/etc.).
export const subscribeFamilyDoc = (treeId: string, cb: (f: FamilyTree | null) => void) =>
  onSnapshot(
    treeDoc(treeId),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) }) : null),
    (e) => { console.warn('subscribeFamilyDoc', e?.message ?? e); cb(null); },
  );

// Live collaborators (membership docs) for one family.
export const subscribeCollaborators = (treeId: string, cb: (c: Collaborator[]) => void) =>
  onSnapshot(
    collection(db, 'trees', treeId, 'memberships'),
    (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Collaborator, 'uid'>) }))),
    (e) => { console.warn('subscribeCollaborators', e?.message ?? e); cb([]); },
  );

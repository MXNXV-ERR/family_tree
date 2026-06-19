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
  onSnapshot, query, where, serverTimestamp, writeBatch,
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

  try {
    const batch = writeBatch(db);

    batch.set(treeRef, {
      name, mono, color, ownerUid: uid,
      surname: input.surname || name.split(/\s+/)[0],
      region: input.region || '',
      summary: input.summary || '',
      kind: 'Your family',
      established: String(new Date().getFullYear()),
      inviteCode: genInvite(input.surname || name),
      createdAt: serverTimestamp(),
    });

    batch.set(membershipDoc(treeId, uid), { uid, email: email || '', role: 'owner', joinedAt: serverTimestamp() });
    batch.set(familyIndexDoc(uid, treeId), { treeId, role: 'owner', name, mono, color } as Membership);

    await batch.commit();

    // Seed the creator so the new tree isn't empty and "You" resolves.
    // addDoc isn't batchable, so we do it as a follow-up.
    await addDoc(collection(treeRef, 'members'), {
      name: input.meName || (email ? email.split('@')[0] : 'Me'),
      gender: 'other', associatedUserId: uid, createdAt: serverTimestamp(),
    });

    return treeId;
  } catch (e) {
    console.error('createFamily failure', e);
    throw e;
  }
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
  const role: FamilyRole = 'member';

  await setDoc(membershipDoc(treeId, uid), { uid, email: email || '', role, joinedAt: serverTimestamp() }, { merge: true });
  await setDoc(familyIndexDoc(uid, treeId), {
    treeId, role, name: data.name || 'Family', mono: data.mono || monoOf(data.name || 'F'), color: data.color || FAMILY_COLORS[0],
  } as Membership);
  return treeId;
}

// Promote / demote a collaborator (owner only — enforced by the rules). Writes
// the authoritative membership doc AND the target user's switcher index so their
// role updates live. Never assigns 'owner' (ownership stays with the creator).
export async function setMemberRole(treeId: string, targetUid: string, role: FamilyRole) {
  const safeRole: FamilyRole = role === 'admin' ? 'admin' : 'member';
  await setDoc(membershipDoc(treeId, targetUid), { role: safeRole }, { merge: true });
  // Owner is allowed to write the target's family index (see firestore.rules).
  await setDoc(familyIndexDoc(targetUid, treeId), { role: safeRole }, { merge: true }).catch((e) => console.warn('setMemberRole index', e?.message ?? e));
}

// Edit family metadata (owner). Also syncs the caller's switcher index basics.
export async function updateFamily(treeId: string, uid: string, data: Partial<FamilyTree>) {
  await updateDoc(treeDoc(treeId), data as any);
  const idxPatch: any = {};
  if (data.name) { idxPatch.name = data.name; idxPatch.mono = monoOf(data.name); }
  if (data.color) idxPatch.color = data.color;
  if (!Object.keys(idxPatch).length) return;
  // Fan the denormalised switcher index out to EVERY collaborator so the family
  // name/colour updates live for them too — not just the editor. The owner is
  // allowed to write collaborators' index docs (see firestore.rules).
  const memSnap = await getDocs(collection(treeDoc(treeId), 'memberships'));
  const uids = new Set<string>([uid, ...memSnap.docs.map((d) => d.id)]);
  await Promise.all(
    [...uids].map((u) =>
      setDoc(familyIndexDoc(u, treeId), idxPatch, { merge: true }).catch((e) =>
        console.warn('updateFamily index', u, e?.message ?? e),
      ),
    ),
  );
}

// Lazily fix a stale denormalised switcher index entry (name/mono/color) against
// the live tree doc — e.g. a family renamed before the collaborator fan-out
// existed still shows its old/placeholder name in another member's switcher.
export async function reconcileFamilyIndex(uid: string, treeId: string, data: { name?: string; mono?: string; color?: string }) {
  const patch: any = {};
  if (data.name) { patch.name = data.name; patch.mono = data.mono ?? monoOf(data.name); }
  if (data.color) patch.color = data.color;
  if (!Object.keys(patch).length) return;
  await setDoc(familyIndexDoc(uid, treeId), patch, { merge: true }).catch((e) => console.warn('reconcileFamilyIndex', e?.message ?? e));
}

// Permanently delete a family the user owns: every member + relationship +
// membership doc, each collaborator's switcher index entry, then the tree doc.
// Caller (UI) blocks deleting the legacy primary tree (treeId === ownerUid) so a
// user is never left with zero trees. Owner-only — enforced by the rules.
export async function deleteFamily(treeId: string, uid: string) {
  const [membersSnap, relsSnap, memSnap] = await Promise.all([
    getDocs(collection(treeDoc(treeId), 'members')),
    getDocs(collection(treeDoc(treeId), 'relationships')),
    getDocs(collection(treeDoc(treeId), 'memberships')),
  ]);

  const refs: any[] = [];
  membersSnap.forEach((d) => refs.push(d.ref));
  relsSnap.forEach((d) => refs.push(d.ref));
  // Each collaborator's membership doc + their per-user switcher index entry
  // (the owner is allowed to write collaborators' index docs — see the rules).
  memSnap.forEach((d) => { refs.push(d.ref); refs.push(familyIndexDoc(d.id, treeId)); });
  refs.push(familyIndexDoc(uid, treeId)); // own index (covers a legacy tree with no membership doc)
  refs.push(treeDoc(treeId));             // appended last so it survives rule checks on the rows above

  // Firestore caps a batch at 500 writes — commit in chunks, tree doc last.
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
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

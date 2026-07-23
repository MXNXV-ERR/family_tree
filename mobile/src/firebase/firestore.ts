// Firestore data access. Same structure as web: trees/{uid}/members + /relationships.
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  serverTimestamp, getDocs, writeBatch, query, where,
} from 'firebase/firestore';
import { db, auth } from './config';
import { logActivity } from './activity';
import type { Member, Relationship, FamilyEvent, Note } from '../shared/types';

const treeRef = (uid: string) => doc(db, 'trees', uid);

// Resilient collection listener: on error (e.g. the ID token expired after the
// tab sat idle, or a transient network drop) it refreshes the token and
// re-subscribes, instead of dying silently and leaving the UI stuck loading.
function resilientCollection<T>(
  makeQuery: () => ReturnType<typeof collection>,
  toItem: (d: any) => T,
  cb: (items: T[]) => void,
  label: string,
): () => void {
  let stopped = false;
  let unsub: () => void = () => {};
  const start = () => {
    unsub = onSnapshot(
      makeQuery(),
      (snap) => cb(snap.docs.map(toItem)),
      async (e) => {
        console.warn(label, (e as any)?.message ?? e);
        try { await auth.currentUser?.getIdToken(true); } catch {}
        if (!stopped) setTimeout(() => { if (!stopped) start(); }, 3000);
      },
    );
  };
  start();
  return () => { stopped = true; unsub(); };
}

export const subscribeMembers = (uid: string, cb: (m: Member[]) => void) =>
  resilientCollection(() => collection(treeRef(uid), 'members'), (d) => ({ id: d.id, ...d.data() }) as Member, cb, 'subscribeMembers');

export const subscribeRelationships = (uid: string, cb: (r: Relationship[]) => void) =>
  resilientCollection(() => collection(treeRef(uid), 'relationships'), (d) => ({ id: d.id, ...d.data() }) as Relationship, cb, 'subscribeRelationships');

export const addMember = (uid: string, m: Omit<Member, 'id'>) => {
  logActivity(uid, 'added', m.name);
  return addDoc(collection(treeRef(uid), 'members'), { ...m, createdAt: serverTimestamp() });
};

export const updateMember = (uid: string, id: string, data: Partial<Member>) => {
  logActivity(uid, 'updated', data.name ?? 'a member');
  return updateDoc(doc(treeRef(uid), 'members', id), data);
};

// Claim a member node as "this is me" — sets associatedUserId to the signed-in
// user. The rules let a plain member do this only on a node with no owner yet.
export const claimMember = (treeId: string, memberId: string, uid: string) =>
  updateMember(treeId, memberId, { associatedUserId: uid });

// Delete a member AND every relationship edge that touches them, atomically, so
// no orphaned spouse/parent edges are left behind (those inflated the couples
// count and broke generation math).
export async function deleteMember(uid: string, id: string) {
  const relsCol = collection(treeRef(uid), 'relationships');
  const [fromSnap, toSnap] = await Promise.all([
    getDocs(query(relsCol, where('fromId', '==', id))),
    getDocs(query(relsCol, where('toId', '==', id))),
  ]);
  const batch = writeBatch(db);
  const seen = new Set<string>();
  [...fromSnap.docs, ...toSnap.docs].forEach((d) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    batch.delete(d.ref);
  });
  batch.delete(doc(treeRef(uid), 'members', id));
  await batch.commit();
  logActivity(uid, 'removed', 'a member');
}

export const addRelationship = (uid: string, r: Omit<Relationship, 'id'>) =>
  addDoc(collection(treeRef(uid), 'relationships'), r);

// Create several relationship edges atomically (Phase 2 cascade links).
export async function addRelationships(uid: string, edges: Omit<Relationship, 'id'>[]) {
  if (!edges.length) return;
  const batch = writeBatch(db);
  const col = collection(treeRef(uid), 'relationships');
  edges.forEach((e) => batch.set(doc(col), e));
  await batch.commit();
  logActivity(uid, 'linked', `${edges.length} relationship${edges.length === 1 ? '' : 's'}`);
}

export const deleteRelationship = (uid: string, id: string) =>
  deleteDoc(doc(treeRef(uid), 'relationships', id));

// Delete several relationship edges atomically (an unlink usually removes a few
// direct + inferred docs together).
export async function deleteRelationships(uid: string, ids: string[]) {
  if (!ids.length) return;
  const batch = writeBatch(db);
  const col = collection(treeRef(uid), 'relationships');
  ids.forEach((id) => batch.delete(doc(col, id)));
  await batch.commit();
}

// Bulk import (Phase 7) — batched writes.
export async function bulkImport(uid: string, members: Member[], relationships: Relationship[]) {
  const batch = writeBatch(db);
  const membersCol = collection(treeRef(uid), 'members');
  const relsCol = collection(treeRef(uid), 'relationships');
  const idMap = new Map<string, string>();
  members.forEach((m) => {
    const ref = doc(membersCol);
    idMap.set(m.id, ref.id);
    const { id, ...rest } = m;
    batch.set(ref, { ...rest, createdAt: serverTimestamp() });
  });
  relationships.forEach((r) => {
    const ref = doc(relsCol);
    const { id, fromId, toId, ...rest } = r;
    batch.set(ref, { ...rest, fromId: idMap.get(fromId) ?? fromId, toId: idMap.get(toId) ?? toId });
  });
  await batch.commit();
  return idMap;
}

// Commit an import merge plan: create new members (capturing real ids), then
// create relationships with placeholder (`new:<importId>`) endpoints rewired to
// the real ids. Existing-member endpoints pass through unchanged.
export async function commitMerge(
  uid: string,
  plan: {
    newMembers: { importId: string; data: Record<string, any> }[];
    newRelationships: { fromId: string; toId: string; type: string; status?: string; marriageDate?: string }[];
  },
): Promise<{ added: number; links: number }> {
  const batch = writeBatch(db);
  const membersCol = collection(treeRef(uid), 'members');
  const relsCol = collection(treeRef(uid), 'relationships');

  const placeholderToReal = new Map<string, string>();
  plan.newMembers.forEach(({ importId, data }) => {
    const ref = doc(membersCol);
    placeholderToReal.set(`new:${importId}`, ref.id);
    batch.set(ref, { ...data, createdAt: serverTimestamp() });
  });

  const resolve = (id: string) => (id.startsWith('new:') ? placeholderToReal.get(id) ?? id : id);
  let links = 0;
  plan.newRelationships.forEach((r) => {
    const fromId = resolve(r.fromId), toId = resolve(r.toId);
    if (fromId.startsWith('new:') || toId.startsWith('new:')) return; // unresolved → skip
    const ref = doc(relsCol);
    const edge: Record<string, any> = { fromId, toId, type: r.type };
    if (r.status) edge.status = r.status;
    if (r.marriageDate) edge.marriageDate = r.marriageDate;
    batch.set(ref, edge);
    links++;
  });

  await batch.commit();
  logActivity(uid, 'imported', `${plan.newMembers.length} member${plan.newMembers.length === 1 ? '' : 's'}, ${links} link${links === 1 ? '' : 's'}`);
  return { added: plan.newMembers.length, links };
}

// ---- Family events (trees/{treeId}/events) ----
// Degrades to an empty list if the events rules aren't deployed yet.
export const subscribeEvents = (treeId: string, cb: (e: FamilyEvent[]) => void) =>
  onSnapshot(
    collection(treeRef(treeId), 'events'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as FamilyEvent[]),
    (e) => { console.warn('subscribeEvents', (e as any)?.message ?? e); cb([]); },
  );

export const addEvent = (treeId: string, e: Omit<FamilyEvent, 'id'>) => {
  logActivity(treeId, 'added event', e.title);
  return addDoc(collection(treeRef(treeId), 'events'), { ...e, createdAt: serverTimestamp() });
};

export const updateEvent = (treeId: string, id: string, data: Partial<FamilyEvent>) =>
  updateDoc(doc(treeRef(treeId), 'events', id), data);

export const deleteEvent = (treeId: string, id: string) =>
  deleteDoc(doc(treeRef(treeId), 'events', id));

// ---- Notes (trees/{treeId}/notes) — private note + image to a claimed member ----
// Rules restrict reads to the recipient (toUid) and sender (fromUid); each query
// below is constrained to one of those so the collection listener is authorised.
// Degrades to an empty list if the notes rules aren't deployed yet.
// Inbox is keyed on the RECIPIENT MEMBER NODE (toMemberId): a note is addressed to
// a member, and whoever has claimed that node ("This is me") reads it. Anyone can
// send; only the claimed owner receives.
export const subscribeInbox = (treeId: string, memberId: string, cb: (n: Note[]) => void) =>
  onSnapshot(
    query(collection(treeRef(treeId), 'notes'), where('toMemberId', '==', memberId)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Note[]),
    (e) => { console.warn('subscribeInbox', (e as any)?.message ?? e); cb([]); },
  );

export const subscribeSent = (treeId: string, uid: string, cb: (n: Note[]) => void) =>
  onSnapshot(
    query(collection(treeRef(treeId), 'notes'), where('fromUid', '==', uid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Note[]),
    (e) => { console.warn('subscribeSent', (e as any)?.message ?? e); cb([]); },
  );

export const addNote = (treeId: string, note: Omit<Note, 'id' | 'createdAt' | 'read'>) =>
  addDoc(collection(treeRef(treeId), 'notes'), { ...note, read: false, createdAt: serverTimestamp() });

export const markNoteRead = (treeId: string, id: string) =>
  updateDoc(doc(treeRef(treeId), 'notes', id), { read: true });

// Recipient's emoji reaction to a note (empty string clears it).
export const setNoteReaction = (treeId: string, id: string, reaction: string) =>
  updateDoc(doc(treeRef(treeId), 'notes', id), { reaction });

export const deleteNote = (treeId: string, id: string) =>
  deleteDoc(doc(treeRef(treeId), 'notes', id));

// Update many members' fields in one chunked batch — the master-edit grid Save
// and the family-photo face assignment both write several members at once.
export async function bulkUpdateMembers(treeId: string, changes: { id: string; data: Partial<Member> }[]) {
  if (!changes.length) return;
  const col = collection(treeRef(treeId), 'members');
  for (let i = 0; i < changes.length; i += 450) {
    const batch = writeBatch(db);
    changes.slice(i, i + 450).forEach(({ id, data }) => batch.update(doc(col, id), data as any));
    await batch.commit();
  }
}

export const _getDocs = getDocs; // re-export for export feature

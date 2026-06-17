// Firestore data access. Same structure as web: trees/{uid}/members + /relationships.
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  serverTimestamp, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { Member, Relationship } from '../shared/types';

const treeRef = (uid: string) => doc(db, 'trees', uid);

export const subscribeMembers = (uid: string, cb: (m: Member[]) => void) =>
  onSnapshot(collection(treeRef(uid), 'members'), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Member[]),
  );

export const subscribeRelationships = (uid: string, cb: (r: Relationship[]) => void) =>
  onSnapshot(collection(treeRef(uid), 'relationships'), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Relationship[]),
  );

export const addMember = (uid: string, m: Omit<Member, 'id'>) =>
  addDoc(collection(treeRef(uid), 'members'), { ...m, createdAt: serverTimestamp() });

export const updateMember = (uid: string, id: string, data: Partial<Member>) =>
  updateDoc(doc(treeRef(uid), 'members', id), data);

// Claim a member node as "this is me" — sets associatedUserId to the signed-in
// user. The rules let a plain member do this only on a node with no owner yet.
export const claimMember = (treeId: string, memberId: string, uid: string) =>
  updateMember(treeId, memberId, { associatedUserId: uid });

export const deleteMember = (uid: string, id: string) =>
  deleteDoc(doc(treeRef(uid), 'members', id));

export const addRelationship = (uid: string, r: Omit<Relationship, 'id'>) =>
  addDoc(collection(treeRef(uid), 'relationships'), r);

// Create several relationship edges atomically (Phase 2 cascade links).
export async function addRelationships(uid: string, edges: Omit<Relationship, 'id'>[]) {
  if (!edges.length) return;
  const batch = writeBatch(db);
  const col = collection(treeRef(uid), 'relationships');
  edges.forEach((e) => batch.set(doc(col), e));
  await batch.commit();
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
  return { added: plan.newMembers.length, links };
}

export const _getDocs = getDocs; // re-export for export feature

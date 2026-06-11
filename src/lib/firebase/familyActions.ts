
import { Member } from '@/types/tree';
import { db } from './config';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, writeBatch, setDoc } from 'firebase/firestore';

// Relationship edge convention (see CLAUDE.md):
//   parent  → directed, fromId = CHILD, toId = PARENT
//   spouse  → bidirectional (two documents, one per direction), optional status
//   sibling → bidirectional (two documents); inferred visually from shared parents

// Helper to get verified tree ref
const getVerifiedTreeRef = (userId: string) => doc(db, 'trees', userId);

export const familyActions = {
    /**
     * Add a child to a parent.
     */
    addChild: async (userId: string, parentId: string, childData: Omit<Member, 'id'>) => {
        // 1. Create Child
        const membersRef = collection(getVerifiedTreeRef(userId), 'members');
        const childDoc = await addDoc(membersRef, { ...childData, createdAt: serverTimestamp() });
        const childId = childDoc.id;

        const relationshipsRef = collection(getVerifiedTreeRef(userId), 'relationships');
        const batch = writeBatch(db);

        // 2. Link Child -> Parent
        const c2pRef = doc(relationshipsRef);
        batch.set(c2pRef, { fromId: childId, toId: parentId, type: 'parent' });

        // 3. Find Parent's existing children (siblings-to-be).
        // Children of parentId are edges { fromId: child, toId: parentId, type: 'parent' }.
        const qSiblings = query(relationshipsRef, where('toId', '==', parentId), where('type', '==', 'parent'));
        const siblingsSnap = await getDocs(qSiblings);

        const existingSiblingIds = new Set<string>();
        siblingsSnap.forEach(docSnap => {
            const siblingId = docSnap.data().fromId;
            if (siblingId !== childId) {
                existingSiblingIds.add(siblingId);
            }
        });

        // 4. Create Sibling Links (bidirectional)
        existingSiblingIds.forEach(siblingId => {
            const s2c = doc(relationshipsRef);
            batch.set(s2c, { fromId: siblingId, toId: childId, type: 'sibling' });

            const c2s = doc(relationshipsRef);
            batch.set(c2s, { fromId: childId, toId: siblingId, type: 'sibling' });
        });

        // 5. Find Parent's current spouse and link the child to them too
        const qSpouse = query(relationshipsRef, where('fromId', '==', parentId), where('type', '==', 'spouse'));
        const spouseSnap = await getDocs(qSpouse);

        spouseSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status === 'divorced') return; // don't auto-link ex-partners
            const spouseId = data.toId;
            // Link Child -> Spouse (second parent)
            const c2sRef = doc(relationshipsRef);
            batch.set(c2sRef, { fromId: childId, toId: spouseId, type: 'parent' });
        });

        await batch.commit();
        return childId;
    },

    /**
     * Add a spouse to a member.
     */
    addSpouse: async (userId: string, originalMemberId: string, spouseData: Omit<Member, 'id'>) => {
        // 1. Create Spouse
        const membersRef = collection(getVerifiedTreeRef(userId), 'members');
        const spouseDoc = await addDoc(membersRef, { ...spouseData, createdAt: serverTimestamp() });
        const spouseId = spouseDoc.id;

        const relationshipsRef = collection(getVerifiedTreeRef(userId), 'relationships');
        const batch = writeBatch(db);

        // 2. Link Bidirectional
        const a2b = doc(relationshipsRef);
        batch.set(a2b, { fromId: originalMemberId, toId: spouseId, type: 'spouse', status: 'current' });

        const b2a = doc(relationshipsRef);
        batch.set(b2a, { fromId: spouseId, toId: originalMemberId, type: 'spouse', status: 'current' });

        // 3. Link Existing Children to the new Spouse.
        // Children of originalMemberId are edges { fromId: child, toId: originalMemberId }.
        const qChildren = query(relationshipsRef, where('toId', '==', originalMemberId), where('type', '==', 'parent'));
        const childrenSnap = await getDocs(qChildren);

        childrenSnap.forEach(docSnap => {
            const childId = docSnap.data().fromId;
            // Link Child -> Spouse
            const c2s = doc(relationshipsRef);
            batch.set(c2s, { fromId: childId, toId: spouseId, type: 'parent' });
        });

        await batch.commit();
        return spouseId;
    },

    /**
     * Add a sibling.
     */
    addSibling: async (userId: string, originalMemberId: string, siblingData: Omit<Member, 'id'>) => {
        // 1. Create Sibling
        const membersRef = collection(getVerifiedTreeRef(userId), 'members');
        const siblingDoc = await addDoc(membersRef, { ...siblingData, createdAt: serverTimestamp() });
        const siblingId = siblingDoc.id;

        const relationshipsRef = collection(getVerifiedTreeRef(userId), 'relationships');
        const batch = writeBatch(db);

        // 2. Find Parents of the original member.
        // Parents are edges { fromId: originalMemberId, toId: parent, type: 'parent' }.
        const qParents = query(relationshipsRef, where('fromId', '==', originalMemberId), where('type', '==', 'parent'));
        const parentsSnap = await getDocs(qParents);

        if (parentsSnap.empty) {
            // Edge case: Original has no parents. Link as siblings directly.
            const s2o = doc(relationshipsRef);
            batch.set(s2o, { fromId: siblingId, toId: originalMemberId, type: 'sibling' });

            const o2s = doc(relationshipsRef);
            batch.set(o2s, { fromId: originalMemberId, toId: siblingId, type: 'sibling' });
        } else {
            parentsSnap.forEach(pDoc => {
                const parentId = pDoc.data().toId;
                // Link New Sibling -> Parent
                const s2p = doc(relationshipsRef);
                batch.set(s2p, { fromId: siblingId, toId: parentId, type: 'parent' });
            });

            // Also link siblings explicitly
            const s2o = doc(relationshipsRef);
            batch.set(s2o, { fromId: siblingId, toId: originalMemberId, type: 'sibling' });

            const o2s = doc(relationshipsRef);
            batch.set(o2s, { fromId: originalMemberId, toId: siblingId, type: 'sibling' });
        }

        await batch.commit();
        return siblingId;
    },

    /**
     * Update tree metadata (e.g. invite code)
     */
    updateTreeMetadata: async (userId: string, data: Record<string, unknown>) => {
        const treeRef = getVerifiedTreeRef(userId);
        await setDoc(treeRef, data, { merge: true });
    }
};

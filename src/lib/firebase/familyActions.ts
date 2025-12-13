
import {
    addMember,
    addRelationship,
} from './firestore';
import { Member, Relationship } from '@/types/tree';
import { db } from './config';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, writeBatch, updateDoc, setDoc } from 'firebase/firestore';

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

        // 2. Link Parent -> Child
        const p2cRef = doc(relationshipsRef);
        batch.set(p2cRef, { fromId: parentId, toId: childId, type: 'parent' });

        // 3. Find Parent's spouse to link them too
        const qSpouse = query(relationshipsRef, where('fromId', '==', parentId), where('type', '==', 'spouse'));
        const spouseSnap = await getDocs(qSpouse);

        spouseSnap.forEach(docSnap => {
            const spouseId = docSnap.data().toId;
            // Link Spouse -> Child
            const s2cRef = doc(relationshipsRef);
            batch.set(s2cRef, { fromId: spouseId, toId: childId, type: 'parent' });
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
        batch.set(a2b, { fromId: originalMemberId, toId: spouseId, type: 'spouse' });

        const b2a = doc(relationshipsRef);
        batch.set(b2a, { fromId: spouseId, toId: originalMemberId, type: 'spouse' });

        // 3. Link Spouse to Existing Children
        const qChildren = query(relationshipsRef, where('fromId', '==', originalMemberId), where('type', '==', 'parent'));
        const childrenSnap = await getDocs(qChildren);

        childrenSnap.forEach(docSnap => {
            const childId = docSnap.data().toId;
            // Link Spouse -> Child
            const s2c = doc(relationshipsRef);
            batch.set(s2c, { fromId: spouseId, toId: childId, type: 'parent' });
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

        // 2. Find Parents (Parent -> Original)
        const qParents = query(relationshipsRef, where('toId', '==', originalMemberId), where('type', '==', 'parent'));
        const parentsSnap = await getDocs(qParents);

        if (parentsSnap.empty) {
            // Edge case: Original has no parents. Link as siblings directly.
            const s2o = doc(relationshipsRef);
            batch.set(s2o, { fromId: siblingId, toId: originalMemberId, type: 'sibling' });

            const o2s = doc(relationshipsRef);
            batch.set(o2s, { fromId: originalMemberId, toId: siblingId, type: 'sibling' });
        } else {
            parentsSnap.forEach(pDoc => {
                const parentId = pDoc.data().fromId;
                // Link Parent -> New Sibling
                const p2s = doc(relationshipsRef);
                batch.set(p2s, { fromId: parentId, toId: siblingId, type: 'parent' });
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
    updateTreeMetadata: async (userId: string, data: any) => {
        const treeRef = getVerifiedTreeRef(userId);
        await setDoc(treeRef, data, { merge: true });
    }
};

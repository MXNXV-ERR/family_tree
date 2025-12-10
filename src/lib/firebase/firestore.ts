import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import { Member, Relationship } from '@/types/tree';

export const MEMBERS_COLLECTION = 'members';
export const RELATIONSHIPS_COLLECTION = 'relationships';
// We structure it as trees/{userId}/members and trees/{userId}/relationships
// This ensures security rules can be easily scoped to the userId

const getVerifiedTreeRef = (userId: string) => doc(db, 'trees', userId);

export const subscribeToMembers = (userId: string, callback: (members: Member[]) => void) => {
    const membersRef = collection(getVerifiedTreeRef(userId), MEMBERS_COLLECTION);

    return onSnapshot(membersRef, (snapshot) => {
        const members = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Member[];
        callback(members);
    });
};

export const subscribeToRelationships = (userId: string, callback: (relationships: Relationship[]) => void) => {
    const relsRef = collection(getVerifiedTreeRef(userId), RELATIONSHIPS_COLLECTION);

    return onSnapshot(relsRef, (snapshot) => {
        const relationships = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Relationship[];
        callback(relationships);
    });
};

export const addMember = async (userId: string, member: Omit<Member, 'id'>) => {
    const membersRef = collection(getVerifiedTreeRef(userId), MEMBERS_COLLECTION);
    return addDoc(membersRef, {
        ...member,
        createdAt: serverTimestamp(),
    });
};

export const updateMember = async (userId: string, memberId: string, data: Partial<Member>) => {
    const docRef = doc(getVerifiedTreeRef(userId), MEMBERS_COLLECTION, memberId);
    return updateDoc(docRef, data);
};

export const deleteMember = async (userId: string, memberId: string) => {
    const docRef = doc(getVerifiedTreeRef(userId), MEMBERS_COLLECTION, memberId);
    return deleteDoc(docRef);
};

export const addRelationship = async (userId: string, relationship: Omit<Relationship, 'id'>) => {
    const relsRef = collection(getVerifiedTreeRef(userId), RELATIONSHIPS_COLLECTION);
    return addDoc(relsRef, relationship);
};

export const deleteRelationship = async (userId: string, relationshipId: string) => {
    const docRef = doc(getVerifiedTreeRef(userId), RELATIONSHIPS_COLLECTION, relationshipId);
    return deleteDoc(docRef);
};

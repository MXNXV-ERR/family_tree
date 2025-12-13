'use client';

import { useState, useEffect } from 'react';
import { subscribeToMembers, subscribeToRelationships } from '@/lib/firebase/firestore';
import { Member, Relationship, TreeMetadata } from '@/types/tree';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export function useFamilyTree(userId: string | undefined | null) {
    const [members, setMembers] = useState<Member[]>([]);
    const [relationships, setRelationships] = useState<Relationship[]>([]);
    const [treeMetadata, setTreeMetadata] = useState<TreeMetadata | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setMembers([]);
            setRelationships([]);
            setTreeMetadata(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubMembers = subscribeToMembers(userId, (data) => {
            setMembers(data);
        });

        const unsubRels = subscribeToRelationships(userId, (data) => {
            setRelationships(data);
        });

        // Subscribe to Tree Metadata (for invite code etc)
        const treeDocRef = doc(db, 'trees', userId);
        const unsubTree = onSnapshot(treeDocRef, (snap) => {
            if (snap.exists()) {
                setTreeMetadata({ id: snap.id, ...snap.data() } as any);
            } else {
                setTreeMetadata(null);
            }
        });

        // In a real app we might want to track loading state better (wait for both)
        // For now we assume fast enough or initial empty state is fine
        setLoading(false);

        return () => {
            unsubMembers();
            unsubRels();
            unsubTree();
        };
    }, [userId]);

    return { members, relationships, treeMetadata, loading };
}

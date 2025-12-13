'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { TreeMetadata } from '@/types/tree';

export function useTreeList(userId: string | undefined | null) {
    const [trees, setTrees] = useState<TreeMetadata[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setTrees([]);
            setLoading(false);
            return;
        }

        const fetchTrees = async () => {
            setLoading(true);
            try {
                const fetchedTrees: TreeMetadata[] = [];

                // 1. Fetch Own Tree (Optimistically assumed to exist or conceptually exists)
                // We check if a tree doc actually exists for this user to confirm.
                const myTreeRef = doc(db, 'trees', userId);
                const myTreeSnap = await getDoc(myTreeRef);

                if (myTreeSnap.exists()) {
                    fetchedTrees.push({ id: userId, ...(myTreeSnap.data() as any) });
                } else {
                    // Even if doc doesn't exist, the user *has* a tree conceptually. 
                    // Should we show it? Yes.
                    fetchedTrees.push({ id: userId, inviteCode: undefined, allowedUsers: [] });
                }

                // 2. Fetch Shared Trees
                // Query trees where allowedUsers array contains userId
                const q = query(collection(db, 'trees'), where('allowedUsers', 'array-contains', userId));
                const querySnapshot = await getDocs(q);

                querySnapshot.forEach((doc) => {
                    // Avoid duplicates if any
                    if (doc.id !== userId) {
                        fetchedTrees.push({ id: doc.id, ...(doc.data() as any) });
                    }
                });

                setTrees(fetchedTrees);

            } catch (error) {
                console.error("Error fetching tree list:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrees();

    }, [userId]);

    return { trees, loading };
}

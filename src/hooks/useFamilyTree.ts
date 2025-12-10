import { useState, useEffect } from 'react';
import { subscribeToMembers, subscribeToRelationships } from '@/lib/firebase/firestore';
import { Member, Relationship } from '@/types/tree';

export function useFamilyTree(userId: string | undefined | null) {
    const [members, setMembers] = useState<Member[]>([]);
    const [relationships, setRelationships] = useState<Relationship[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setMembers([]);
            setRelationships([]);
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

        // In a real app we might want to track loading state better (wait for both)
        // For now we assume fast enough or initial empty state is fine
        setLoading(false);

        return () => {
            unsubMembers();
            unsubRels();
        };
    }, [userId]);

    return { members, relationships, loading };
}

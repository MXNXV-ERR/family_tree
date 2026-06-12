// Real-time tree subscription — mirrors the web useFamilyTree hook.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './config';
import { subscribeMembers, subscribeRelationships } from './firestore';
import type { Member, Relationship, TreeMetadata } from '../shared/types';

export function useFamilyTree(uid: string | null | undefined) {
  const [members, setMembers] = useState<Member[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [treeMetadata, setTreeMetadata] = useState<TreeMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setMembers([]); setRelationships([]); setTreeMetadata(null); setLoading(false);
      return;
    }
    setLoading(true);
    const unsubM = subscribeMembers(uid, setMembers);
    const unsubR = subscribeRelationships(uid, setRelationships);
    const unsubT = onSnapshot(doc(db, 'trees', uid), (snap) => {
      setTreeMetadata(snap.exists() ? ({ id: snap.id, ...snap.data() } as TreeMetadata) : null);
    });
    setLoading(false);
    return () => { unsubM(); unsubR(); unsubT(); };
  }, [uid]);

  return { members, relationships, treeMetadata, loading };
}

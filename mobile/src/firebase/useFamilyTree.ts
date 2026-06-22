// Real-time tree subscription — mirrors the web useFamilyTree hook.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './config';
import { subscribeMembers, subscribeRelationships, subscribeEvents } from './firestore';
import type { Member, Relationship, TreeMetadata, FamilyEvent } from '../shared/types';

export function useFamilyTree(treeId: string | null | undefined) {
  const [members, setMembers] = useState<Member[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [treeMetadata, setTreeMetadata] = useState<TreeMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!treeId) {
      setMembers([]); setRelationships([]); setEvents([]); setTreeMetadata(null); setLoading(false);
      return;
    }
    setLoading(true);
    const unsubM = subscribeMembers(treeId, setMembers);
    const unsubR = subscribeRelationships(treeId, setRelationships);
    const unsubE = subscribeEvents(treeId, setEvents);
    const unsubT = onSnapshot(doc(db, 'trees', treeId), (snap) => {
      setTreeMetadata(snap.exists() ? ({ id: snap.id, ...snap.data() } as TreeMetadata) : null);
    });
    setLoading(false);
    return () => { unsubM(); unsubR(); unsubE(); unsubT(); };
  }, [treeId]);

  return { members, relationships, events, treeMetadata, loading };
}

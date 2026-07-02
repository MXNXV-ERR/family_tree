// Real-time subscription for a master (combined) family. Subscribes to the
// master doc, then to the members + relationships of each constituent tree, and
// unions them into one namespaced {members, relationships} graph the existing
// visualizers can render unchanged. Edits route to the origin tree via splitId.
import { useEffect, useMemo, useState } from 'react';
import {
  subscribeMaster, subscribeMembers, subscribeRelationships, buildMasterData,
} from './masters';
import type { Member, Relationship, MasterFamily } from '../shared/types';

type TreeData = { members: Member[]; relationships: Relationship[] };

export function useMasterTree(masterId: string | null | undefined) {
  const [master, setMaster] = useState<MasterFamily | null>(null);
  const [perTree, setPerTree] = useState<Record<string, TreeData>>({});
  const [loading, setLoading] = useState(true);

  // 1. the master doc (treeIds + bridge links)
  useEffect(() => {
    if (!masterId) { setMaster(null); setPerTree({}); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeMaster(masterId, setMaster);
    return () => unsub();
  }, [masterId]);

  // 2. each constituent tree's members + relationships
  const treeIds = useMemo(() => master?.memberTreeIds ?? [], [master]);
  const treeKey = treeIds.join('|');
  useEffect(() => {
    if (!treeIds.length) { setPerTree({}); setLoading(false); return; }
    const unsubs: Array<() => void> = [];
    for (const tid of treeIds) {
      unsubs.push(subscribeMembers(tid, (mm) =>
        setPerTree((p) => ({ ...p, [tid]: { members: mm, relationships: p[tid]?.relationships ?? [] } }))));
      unsubs.push(subscribeRelationships(tid, (rr) =>
        setPerTree((p) => ({ ...p, [tid]: { members: p[tid]?.members ?? [], relationships: rr } }))));
    }
    setLoading(false);
    return () => unsubs.forEach((u) => u());
  }, [treeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. union
  const { members, relationships } = useMemo(() => {
    const trees = treeIds.map((tid) => ({
      treeId: tid,
      members: perTree[tid]?.members ?? [],
      relationships: perTree[tid]?.relationships ?? [],
    }));
    return buildMasterData(trees, master?.links ?? []);
  }, [perTree, master, treeIds]);

  return { master, members, relationships, loading };
}

// Active-family context. Backfills the user's primary tree, subscribes to the
// families they belong to, and tracks the active treeId (persisted per-uid).
// Every data screen reads `activeTreeId` from here instead of user.uid, so the
// app can switch between families while old single-tree data still loads
// (legacy treeId === uid).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { subscribeMyFamilies, ensurePrimaryFamily } from './families';
import type { FamilyTree, Membership } from '../shared/types';

interface FamilyCtx {
  families: FamilyTree[];
  activeTreeId: string | null;
  activeFamily: FamilyTree | null;
  setActiveTreeId: (id: string) => void;
  loadingFamilies: boolean;
}

const Ctx = createContext<FamilyCtx>({
  families: [], activeTreeId: null, activeFamily: null, setActiveTreeId: () => {}, loadingFamilies: true,
});

export const useFamily = () => useContext(Ctx);

const activeKey = (uid: string) => `ft.activeTree.${uid}`;

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [families, setFamilies] = useState<FamilyTree[]>([]);
  const [activeTreeId, setActiveState] = useState<string | null>(null);
  const [loadingFamilies, setLoading] = useState(true);

  // Backfill + subscribe to the user's families.
  useEffect(() => {
    if (!uid) { setFamilies([]); setActiveState(null); setLoading(false); return; }
    let unsub = () => {};
    let cancelled = false;
    setLoading(true);
    (async () => {
      try { await ensurePrimaryFamily(uid, user?.email); } catch (e) { console.warn('ensurePrimaryFamily', e); }
      if (cancelled) return;
      unsub = subscribeMyFamilies(uid, (mem: Membership[]) => {
        const list: FamilyTree[] = mem.map((m) => ({
          id: m.treeId, name: m.name, mono: m.mono, color: m.color, role: m.role, ownerUid: m.role === 'owner' ? uid : '',
        }));
        // Stable order: primary (treeId === uid) first, then by name.
        list.sort((a, b) => (a.id === uid ? -1 : b.id === uid ? 1 : a.name.localeCompare(b.name)));
        setFamilies(list);
        setLoading(false);
      });
    })();
    return () => { cancelled = true; unsub(); };
  }, [uid]);

  // Restore the persisted active tree once we know the user.
  useEffect(() => {
    if (!uid) return;
    AsyncStorage.getItem(activeKey(uid)).then((v) => setActiveState(v || uid));
  }, [uid]);

  // Keep the active tree valid against the live family list.
  useEffect(() => {
    if (!uid || loadingFamilies) return;
    if (!families.length) return;
    if (!activeTreeId || !families.some((f) => f.id === activeTreeId)) {
      setActiveState(families.some((f) => f.id === uid) ? uid : families[0].id);
    }
  }, [families, activeTreeId, uid, loadingFamilies]);

  const setActiveTreeId = (id: string) => {
    setActiveState(id);
    if (uid) AsyncStorage.setItem(activeKey(uid), id).catch(() => {});
  };

  const activeFamily = useMemo(
    () => families.find((f) => f.id === activeTreeId) ?? null,
    [families, activeTreeId],
  );

  return (
    <Ctx.Provider value={{ families, activeTreeId, activeFamily, setActiveTreeId, loadingFamilies }}>
      {children}
    </Ctx.Provider>
  );
}

// Active-family context. Backfills the user's primary tree, subscribes to the
// families they belong to, and tracks the active treeId (persisted per-uid).
// Every data screen reads `activeTreeId` from here instead of user.uid, so the
// app can switch between families while old single-tree data still loads
// (legacy treeId === uid).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { kvGet, kvSet } from './kvStore';
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
  // True once the persisted selection has been read back from storage. The
  // fallback effect must wait for this, else it snaps the user to their primary
  // tree on every refresh before the saved choice has loaded.
  const [hydrated, setHydrated] = useState(false);

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

  // Restore the persisted active tree once we know the user. `hydrated` gates
  // the fallback below so a not-yet-loaded selection is never overwritten.
  useEffect(() => {
    if (!uid) { setHydrated(false); return; }
    setHydrated(false);
    let cancelled = false;
    kvGet(activeKey(uid))
      .then((v) => { if (!cancelled) { setActiveState(v || uid); setHydrated(true); } })
      .catch(() => { if (!cancelled) setHydrated(true); });
    return () => { cancelled = true; };
  }, [uid]);

  // Keep the active tree valid against the live family list — but only after the
  // saved selection has been restored, so a refresh holds the chosen family.
  useEffect(() => {
    if (!uid || !hydrated || loadingFamilies || !families.length) return;
    if (activeTreeId && families.some((f) => f.id === activeTreeId)) return; // already valid
    // The membership list can arrive across several snapshots on reload, so wait
    // briefly before snapping to a default — otherwise a freshly-restored choice
    // gets clobbered by a transient list that doesn't yet include it.
    const t = setTimeout(() => {
      setActiveState((cur) =>
        cur && families.some((f) => f.id === cur)
          ? cur
          : (families.some((f) => f.id === uid) ? uid : families[0].id));
    }, 1500);
    return () => clearTimeout(t);
  }, [families, activeTreeId, uid, loadingFamilies, hydrated]);

  const setActiveTreeId = (id: string) => {
    setActiveState(id);
    if (uid) kvSet(activeKey(uid), id).catch(() => {});
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

// Active-family context. Backfills the user's primary tree, subscribes to the
// families they belong to, and tracks the active treeId (persisted per-uid).
// Every data screen reads `activeTreeId` from here instead of user.uid, so the
// app can switch between families while old single-tree data still loads
// (legacy treeId === uid).
//
// New accounts (no legacy tree, no active membership) get `needsOnboarding` so
// the home gate can route them to Create-or-Join. Pending join requests
// (approval policy) are self-healed here: when the owner/admin approves, the
// requester's own client flips its switcher index to active.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { kvGet, kvSet } from './kvStore';
import { auth } from './config';
import { useAuth } from './AuthContext';
import {
  subscribeMyFamilies, ensurePrimaryFamily, hasPrimaryTree,
  subscribeJoinRequest, settleApprovedJoin, cancelJoinRequest,
} from './families';
import { subscribeMyMasters } from './masters';
import type { FamilyTree, Membership, MasterIndex } from '../shared/types';

interface FamilyCtx {
  families: FamilyTree[];
  memberships: Membership[];
  masters: MasterIndex[];
  activeTreeId: string | null;
  activeFamily: FamilyTree | null;
  setActiveTreeId: (id: string) => void;
  loadingFamilies: boolean;
  needsOnboarding: boolean;
}

const Ctx = createContext<FamilyCtx>({
  families: [], memberships: [], masters: [], activeTreeId: null, activeFamily: null,
  setActiveTreeId: () => {}, loadingFamilies: true, needsOnboarding: false,
});

export const useFamily = () => useContext(Ctx);

const activeKey = (uid: string) => `ft.activeTree.${uid}`;

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [families, setFamilies] = useState<FamilyTree[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [masters, setMasters] = useState<MasterIndex[]>([]);
  const [activeTreeId, setActiveState] = useState<string | null>(null);
  const [loadingFamilies, setLoading] = useState(true);
  // True only after a SUCCESSFUL families snapshot — gates onboarding so an
  // errored read (token expiry / rules) is never mistaken for "no families".
  const [familiesLoaded, setFamiliesLoaded] = useState(false);
  // null = not checked yet, true/false = whether a legacy primary tree exists.
  const [hasLegacy, setHasLegacy] = useState<boolean | null>(null);
  // True once the persisted selection has been read back from storage. The
  // fallback effect must wait for this, else it snaps the user to their primary
  // tree on every refresh before the saved choice has loaded.
  const [hydrated, setHydrated] = useState(false);

  // Backfill + subscribe to the user's families.
  useEffect(() => {
    if (!uid) { setFamilies([]); setMemberships([]); setActiveState(null); setHasLegacy(null); setFamiliesLoaded(false); setLoading(false); return; }
    let unsub = () => {};
    let cancelled = false;
    setLoading(true);
    setHasLegacy(null);
    setFamiliesLoaded(false);
    (async () => {
      try { await ensurePrimaryFamily(uid, user?.email); } catch (e) { console.warn('ensurePrimaryFamily', e); }
      if (cancelled) return;
      try { const has = await hasPrimaryTree(uid); if (!cancelled) setHasLegacy(has); } catch { if (!cancelled) setHasLegacy(false); }
      if (cancelled) return;
      unsub = subscribeMyFamilies(uid, (mem: Membership[]) => {
        setMemberships(mem);
        const list: FamilyTree[] = mem.map((m) => ({
          id: m.treeId, name: m.name, mono: m.mono, color: m.color, role: m.role, ownerUid: m.role === 'owner' ? uid : '',
        }));
        // Stable order: primary (treeId === uid) first, then by name.
        list.sort((a, b) => (a.id === uid ? -1 : b.id === uid ? 1 : a.name.localeCompare(b.name)));
        setFamilies(list);
        setFamiliesLoaded(true);
        setLoading(false);
      }, () => {
        // Errored (token expiry / rules) — keep the last list; don't mark loaded so
        // a transient failure never flips the user into onboarding.
        setLoading(false);
      });
    })();
    return () => { cancelled = true; unsub(); };
  }, [uid]);

  // Subscribe to the user's master (combined) families for the switcher.
  useEffect(() => {
    if (!uid) { setMasters([]); return; }
    const unsub = subscribeMyMasters(uid, setMasters);
    return () => unsub();
  }, [uid]);

  // Refresh the auth token + nudge reconnect when the tab returns to focus or the
  // network comes back, so realtime listeners don't sit dead after a long idle.
  useEffect(() => {
    if (Platform.OS !== 'web' || !uid) return;
    const refresh = () => { auth.currentUser?.getIdToken(true).catch(() => {}); };
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') refresh(); };
    if (typeof window !== 'undefined') window.addEventListener('online', refresh);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('online', refresh);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [uid]);

  // Watchdog — never hang on the families spinner forever.
  useEffect(() => {
    if (!loadingFamilies) return;
    const t = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(t);
  }, [loadingFamilies]);

  // Self-heal pending join requests: when an owner/admin approves, flip our own
  // switcher index to active; if rejected, drop the pending entry.
  const pendingKey = memberships.filter((m) => m.status === 'pending').map((m) => m.treeId).sort().join('|');
  useEffect(() => {
    if (!uid || !pendingKey) return;
    const ids = pendingKey.split('|');
    const unsubs = ids.map((treeId) =>
      subscribeJoinRequest(treeId, uid, (req) => {
        if (!req) return;
        if (req.status === 'approved') settleApprovedJoin(uid, treeId).catch((e) => console.warn('settleApprovedJoin', e));
        else if (req.status === 'rejected') cancelJoinRequest(uid, treeId).catch((e) => console.warn('reject cleanup', e));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [uid, pendingKey]);

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

  // A brand-new account: signed in, families loaded, confirmed no legacy tree,
  // and no ACTIVE membership (a pending-only request still counts as needing
  // onboarding — the onboard screen shows the pending state).
  const activeCount = memberships.filter((m) => m.status !== 'pending').length;
  const needsOnboarding = !!uid && !loadingFamilies && hydrated && familiesLoaded && hasLegacy === false && activeCount === 0;

  return (
    <Ctx.Provider value={{ families, memberships, masters, activeTreeId, activeFamily, setActiveTreeId, loadingFamilies, needsOnboarding }}>
      {children}
    </Ctx.Provider>
  );
}

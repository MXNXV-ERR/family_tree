// Master (combined-family) view. Unions several trees the user belongs to into
// one browsable super-tree. Read-through: tapping a person opens their profile
// against the ORIGIN tree (ids are namespaced `treeId:localId`), so any edit
// routes back to the right family. Bridges are managed from /combine.
//
// Responsive: wide web gets the desktop chrome (top toolbar + counts sub-bar +
// right profile drawer); native / narrow web keep the mobile stack.
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useMasterTree } from '../src/firebase/useMasterTree';
import { splitId } from '../src/firebase/masters';
import { useResponsive } from '../src/ui/useResponsive';
import { useTheme, radius, font } from '../src/theme/theme';
import { Icon } from '../src/ui/Icon';
import { SegTabs, SlideSwap, IconBtn } from '../src/ui/primitives';
import { buildAdjacency } from '../src/shared/adjacency';
import { TreeView } from '../src/viz/TreeView';
import { RadialView } from '../src/viz/RadialView';
import { TimelineView } from '../src/viz/TimelineView';
import { NetworkView } from '../src/viz/NetworkView';
import { SubBarZoom, type ZoomApi } from '../src/viz/vizChrome';
import { DesktopDrawer } from '../src/desktop/DesktopDrawer';
import { DesktopProfile } from '../src/desktop/DesktopProfile';
import type { Member } from '../src/shared/types';

type ViewKind = 'tree' | 'radial' | 'timeline' | 'network';
const VIEWS: [ViewKind, string][] = [['tree', 'Tree'], ['radial', 'Radial'], ['timeline', 'Timeline'], ['network', 'Network']];

// Defined BEFORE MasterScreen so there's no forward reference (a hoisted
// declaration used at another module position tripped Fast Refresh).
function FamilyLegend({ items, c }: { items: { id: string; name: string; color: string }[]; c: ReturnType<typeof useTheme>['c'] }) {
  if (items.length < 2) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      {items.map((f) => (
        <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: f.color }} />
          <Text numberOfLines={1} style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 12, maxWidth: 160 }}>{f.name}</Text>
        </View>
      ))}
    </View>
  );
}

export default function MasterScreen() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { families } = useFamily();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { master, members, relationships, loading } = useMasterTree(id);

  // Tint each node by its source family (ids are `treeId:localId`).
  const treeColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of families) if (f.color) map.set(f.id, f.color);
    return map;
  }, [families]);
  const colorOf = useMemo(() => (mid: string) => {
    const s = splitId(mid);
    return s ? treeColor.get(s.treeId) : undefined;
  }, [treeColor]);
  const legend = useMemo(
    () => (master?.memberTreeIds ?? []).map((tid) => ({ id: tid, name: families.find((f) => f.id === tid)?.name ?? 'Family', color: treeColor.get(tid) ?? c.accent })),
    [master, families, treeColor, c.accent],
  );
  const [view, setView] = useState<ViewKind>('tree');
  const [focusId, setFocusId] = useState<string>('');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [zoomApi, setZoomApi] = useState<ZoomApi | null>(null);

  const meId = useMemo(() => members.find((m) => m.associatedUserId === user?.uid)?.id, [members, user]);
  const adjacency = useMemo(() => buildAdjacency(members, relationships), [members, relationships]);

  useEffect(() => { setFocusId(''); setDrawerId(null); }, [id]);
  useEffect(() => { if (!focusId && members.length) setFocusId(meId ?? members[0].id); }, [members, meId, focusId]);
  useEffect(() => { setZoomApi(null); }, [view]);

  // Desktop opens the profile in the right drawer; mobile navigates full-screen.
  const openProfile = (m: Member) =>
    isDesktop ? setDrawerId(m.id) : router.push({ pathname: '/profile', params: { id: m.id } });
  const openBridges = () => router.push({ pathname: '/combine' as never, params: { id: id ?? '' } });

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>;
  }

  const shared = { members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile: openProfile };
  const subtitle = `${master?.memberTreeIds.length ?? 0} families · ${members.length} people`;

  const canvas = focusId ? (
    <SlideSwap activeKey={view} index={VIEWS.findIndex(([v]) => v === view)} style={{ flex: 1 }}>
      {view === 'tree' ? <TreeView {...shared} layered colorOf={colorOf} onZoomReady={setZoomApi} hideZoomUI={isDesktop} />
        : view === 'radial' ? <RadialView {...shared} colorOf={colorOf} onZoomReady={setZoomApi} hideZoomUI={isDesktop} />
        : view === 'timeline' ? <TimelineView {...shared} events={[]} onZoomReady={setZoomApi} hideZoomUI={isDesktop} />
        : <NetworkView {...shared} colorOf={colorOf} onZoomReady={setZoomApi} hideZoomUI={isDesktop} />}
    </SlideSwap>
  ) : (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <Icon name="users" size={30} color={c.faint} />
      <Text style={{ color: c.mute, fontFamily: font.sans, textAlign: 'center', lineHeight: 20 }}>No people yet. Add families to this combined view.</Text>
      <Pressable onPress={openBridges} style={{ height: 46, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.accentInk, fontFamily: font.sansBold }}>Manage families</Text>
      </Pressable>
    </View>
  );

  // ---- Desktop chrome ----
  if (isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.lineSoft }}>
          <IconBtn name="back" tone="ghost" onPress={() => router.back()} />
          <View style={{ minWidth: 200 }}>
            <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 20 }}>{master?.name ?? 'Combined family'}</Text>
            <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5 }}>{subtitle}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SegTabs<ViewKind> value={view} onChange={setView} options={VIEWS} fill={false} fontSize={14} />
          </View>
          <Pressable onPress={openBridges} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <Icon name="link" size={17} color={c.accent} />
            <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 13.5 }}>Bridges</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.lineSoft }}>
          <FamilyLegend items={legend} c={c} />
          <SubBarZoom api={zoomApi} />
        </View>

        <View style={{ flex: 1 }}>
          {canvas}
          <DesktopDrawer open={!!drawerId} onClose={() => setDrawerId(null)}>
            {drawerId ? (
              <DesktopProfile
                adj={adjacency} id={drawerId} meId={meId}
                canAddRelative={false}
                onClose={() => setDrawerId(null)}
                onEdit={(mid) => router.push({ pathname: '/member', params: { id: mid } })}
                onOpen={(mid) => setDrawerId(mid)}
                onAddRelative={() => router.push({ pathname: '/link', params: { a: drawerId } })}
                onFocusInTree={(mid) => { setFocusId(mid); setDrawerId(null); }} />
            ) : null}
          </DesktopDrawer>
        </View>
      </View>
    );
  }

  // ---- Mobile chrome ----
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Icon name="back" size={20} color={c.accent} /></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.serif, fontSize: 18 }}>{master?.name ?? 'Combined family'}</Text>
          <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5 }}>{subtitle}</Text>
        </View>
        <Pressable onPress={openBridges} hitSlop={8} style={{ padding: 7, borderRadius: radius.md, borderWidth: 1, borderColor: c.line }}>
          <Icon name="link" size={18} color={c.accent} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <SegTabs<ViewKind> value={view} onChange={setView} options={VIEWS}
          activeBg={c.accentSoft} activeColor={c.accent} rad={radius.md} pad={3} gap={3} padV={8} fontSize={13} />
      </View>
      {legend.length >= 2 ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 8 }}><FamilyLegend items={legend} c={c} /></View>
      ) : null}
      {canvas}
    </View>
  );
}

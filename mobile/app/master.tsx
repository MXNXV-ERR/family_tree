// Master (combined-family) view. Unions several trees the user belongs to into
// one browsable super-tree. Read-through: tapping a person opens their profile
// against the ORIGIN tree (ids are namespaced `treeId:localId`), so any edit
// routes back to the right family. Bridges are managed from /combine.
//
// The combined view is a distinct "place" in the app: it keeps its own amber
// accent (instead of the app-wide purple) on tabs, toolbar, and a faint canvas
// wash, so you always know you're looking across families, not inside one.
//
// Responsive: wide web gets the desktop chrome (top toolbar + counts sub-bar +
// right drawer hosting profile/settings/chat/members); native / narrow web keep
// the mobile stack with panels in bottom sheets. Search is a shared overlay.
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useMasterTree } from '../src/firebase/useMasterTree';
import { splitId } from '../src/firebase/masters';
import { useResponsive } from '../src/ui/useResponsive';
import { useTheme, radius, font } from '../src/theme/theme';
import { Icon, type IconName } from '../src/ui/Icon';
import { SegTabs, SlideSwap, IconBtn, ThemeToggle } from '../src/ui/primitives';
import { buildAdjacency } from '../src/shared/adjacency';
import { TreeView } from '../src/viz/TreeView';
import { RadialView } from '../src/viz/RadialView';
import { TimelineView } from '../src/viz/TimelineView';
import { NetworkView } from '../src/viz/NetworkView';
import { SubBarZoom, type ZoomApi } from '../src/viz/vizChrome';
import { DesktopDrawer } from '../src/desktop/DesktopDrawer';
import { DesktopProfile } from '../src/desktop/DesktopProfile';
import { BottomSheet } from '../src/components/BottomSheet';
import { SearchOverlay } from '../src/components/SearchOverlay';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { ChatPanel } from '../src/components/ChatPanel';
import { MembersPanel } from '../src/components/MembersPanel';
import type { Member } from '../src/shared/types';

type ViewKind = 'tree' | 'radial' | 'timeline' | 'network';
const VIEWS: [ViewKind, string][] = [['tree', 'Tree'], ['radial', 'Radial'], ['timeline', 'Timeline'], ['network', 'Network']];
type PanelKind = 'settings' | 'chat' | 'members';

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

// Amber-tinted toolbar button (IconBtn's tones are wired to the purple accent).
function ToolBtn({ name, tint, onPress, size = 42 }: { name: IconName; tint: string; onPress: () => void; size?: number }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={name} style={({ pressed }) => ({
      width: size, height: size, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.94 : 1 }],
    })}>
      <Icon name={name} size={size >= 40 ? 19 : 17} color={tint} />
    </Pressable>
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

  // The combined view's own accent — everything "master" is amber, not purple.
  const CV = c.amber;

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
  const familyNameOf = useMemo(() => (mid: string) => {
    const s = splitId(mid);
    return s ? families.find((f) => f.id === s.treeId)?.name : undefined;
  }, [families]);
  const legend = useMemo(
    () => (master?.memberTreeIds ?? []).map((tid) => ({ id: tid, name: families.find((f) => f.id === tid)?.name ?? 'Family', color: treeColor.get(tid) ?? c.accent })),
    [master, families, treeColor, c.accent],
  );
  const [view, setView] = useState<ViewKind>('tree');
  const [focusId, setFocusId] = useState<string>('');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoomApi, setZoomApi] = useState<ZoomApi | null>(null);

  const meId = useMemo(() => members.find((m) => m.associatedUserId === user?.uid)?.id, [members, user]);
  const adjacency = useMemo(() => buildAdjacency(members, relationships), [members, relationships]);

  useEffect(() => { setFocusId(''); setDrawerId(null); setPanel(null); setSearchOpen(false); }, [id]);
  useEffect(() => { if (!focusId && members.length) setFocusId(meId ?? members[0].id); }, [members, meId, focusId]);
  useEffect(() => { setZoomApi(null); }, [view]);

  // Desktop opens the profile in the right drawer; mobile navigates full-screen.
  const openProfile = (m: Member) => {
    if (isDesktop) { setPanel(null); setDrawerId(m.id); }
    else router.push({ pathname: '/profile', params: { id: m.id } });
  };
  const openPanel = (p: PanelKind) => { setDrawerId(null); setPanel(p); };
  const closeOverlays = () => { setDrawerId(null); setPanel(null); };
  const openBridges = () => router.push({ pathname: '/combine' as never, params: { id: id ?? '' } });
  const openScan = () => router.push({ pathname: '/facematch', params: { master: id ?? '' } });
  const pickSearch = (m: Member) => {
    setFocusId(m.id);
    setSearchOpen(false);
    if (isDesktop) { setPanel(null); setDrawerId(m.id); }
  };

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={CV} /></View>;
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
      <Pressable onPress={openBridges} style={{ height: 46, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: CV, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.accentInk, fontFamily: font.sansBold }}>Manage families</Text>
      </Pressable>
    </View>
  );

  // Faint amber wash behind the canvas — marks the combined view as its own place.
  const washedCanvas = (
    <View style={{ flex: 1 }}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: CV, opacity: 0.03 }]} />
      {canvas}
    </View>
  );

  const search = (
    <SearchOverlay visible={searchOpen} members={members} colorOf={colorOf} familyNameOf={familyNameOf}
      onPick={pickSearch} onClose={() => setSearchOpen(false)} />
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
            <SegTabs<ViewKind> value={view} onChange={setView} options={VIEWS} fill={false} fontSize={14}
              activeBg={CV + '26'} activeColor={CV} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ToolBtn name="search" tint={CV} onPress={() => setSearchOpen(true)} />
            <ToolBtn name="scan" tint={CV} onPress={openScan} />
            <ToolBtn name="users" tint={CV} onPress={() => openPanel('members')} />
            <ToolBtn name="sparkles" tint={CV} onPress={() => openPanel('chat')} />
            <ToolBtn name="settings" tint={CV} onPress={() => openPanel('settings')} />
            <ThemeToggle />
            <Pressable onPress={openBridges} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <Icon name="link" size={17} color={CV} />
              <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 13.5 }}>Bridges</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.lineSoft }}>
          <FamilyLegend items={legend} c={c} />
          <SubBarZoom api={zoomApi} />
        </View>

        <View style={{ flex: 1 }}>
          {washedCanvas}
          <DesktopDrawer open={!!drawerId || !!panel} onClose={closeOverlays}>
            {drawerId ? (
              <DesktopProfile
                adj={adjacency} id={drawerId} meId={meId}
                canAddRelative={false}
                onClose={() => setDrawerId(null)}
                onEdit={(mid) => router.push({ pathname: '/member', params: { id: mid } })}
                onOpen={(mid) => setDrawerId(mid)}
                onAddRelative={() => router.push({ pathname: '/link', params: { a: drawerId } })}
                onFocusInTree={(mid) => { setFocusId(mid); setDrawerId(null); }} />
            ) : panel === 'settings' ? (
              <SettingsPanel onClose={closeOverlays} />
            ) : panel === 'chat' ? (
              <ChatPanel members={members} relationships={relationships} sessionKey={`master:${id ?? ''}`} onOpenMember={openProfile} onClose={closeOverlays} />
            ) : panel === 'members' ? (
              <MembersPanel members={members} meId={meId} onOpenProfile={openProfile} onOpenFamilyInfo={openBridges} onClose={closeOverlays} />
            ) : null}
          </DesktopDrawer>
        </View>
        {search}
      </View>
    );
  }

  // ---- Mobile chrome ----
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, gap: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Icon name="back" size={20} color={CV} /></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.serif, fontSize: 18 }}>{master?.name ?? 'Combined family'}</Text>
          <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5 }}>{subtitle}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <ToolBtn name="search" tint={CV} size={34} onPress={() => setSearchOpen(true)} />
          <ToolBtn name="scan" tint={CV} size={34} onPress={openScan} />
          <ToolBtn name="users" tint={CV} size={34} onPress={() => openPanel('members')} />
          <ToolBtn name="sparkles" tint={CV} size={34} onPress={() => openPanel('chat')} />
          <ToolBtn name="settings" tint={CV} size={34} onPress={() => openPanel('settings')} />
          <ToolBtn name="link" tint={CV} size={34} onPress={openBridges} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <SegTabs<ViewKind> value={view} onChange={setView} options={VIEWS}
          activeBg={CV + '26'} activeColor={CV} rad={radius.md} pad={3} gap={3} padV={8} fontSize={13} />
      </View>
      {legend.length >= 2 ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 8 }}><FamilyLegend items={legend} c={c} /></View>
      ) : null}
      {washedCanvas}

      <BottomSheet visible={panel === 'settings'} onClose={() => setPanel(null)} heightRatio={0.74}>
        <SettingsPanel onClose={() => setPanel(null)} />
      </BottomSheet>
      <BottomSheet visible={panel === 'chat'} onClose={() => setPanel(null)} heightRatio={0.9}>
        <ChatPanel members={members} relationships={relationships} sessionKey={`master:${id ?? ''}`}
          onOpenMember={(m) => { setPanel(null); openProfile(m); }} onClose={() => setPanel(null)} />
      </BottomSheet>
      <BottomSheet visible={panel === 'members'} onClose={() => setPanel(null)} heightRatio={0.85}>
        <MembersPanel members={members} meId={meId}
          onOpenProfile={(m) => { setPanel(null); openProfile(m); }}
          onOpenFamilyInfo={() => { setPanel(null); openBridges(); }}
          onClose={() => setPanel(null)} />
      </BottomSheet>
      {search}
    </View>
  );
}

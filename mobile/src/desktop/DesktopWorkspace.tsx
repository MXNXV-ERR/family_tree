// Responsive desktop workspace (web, wide viewports) — the design's DesktopApp.
// A tree-first canvas with a top toolbar (family switcher · view switcher ·
// search · tools), a sub-bar with live counts, and a right detail drawer that
// hosts the profile / member form / settings / family info / chat. Reuses the
// same visualizers and panels as mobile.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../firebase/AuthContext';
import { useFamily } from '../firebase/FamilyContext';
import { useFamilyTree } from '../firebase/useFamilyTree';
import { addMember, updateMember, deleteMember, deleteRelationship } from '../firebase/firestore';
import { buildAdjacency, computeGenerations, lifespan } from '../shared/adjacency';
import { useTheme, font, radius, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Avatar, IconBtn, ThemeToggle } from '../ui/primitives';
import { Icon, type IconName } from '../ui/Icon';
import { TreeView } from '../viz/TreeView';
import { RadialView } from '../viz/RadialView';
import { TimelineView } from '../viz/TimelineView';
import { SubBarZoom, type ZoomApi } from '../viz/vizChrome';
import { DesktopDrawer } from './DesktopDrawer';
import { DesktopProfile } from './DesktopProfile';
import { MemberForm } from '../components/MemberForm';
import { SettingsPanel } from '../components/SettingsPanel';
import { FamilyInfoPanel } from '../components/FamilyInfoPanel';
import { FamilyPickerPanel } from '../components/FamilyPickerPanel';
import { ChatPanel } from '../components/ChatPanel';
import type { Member } from '../shared/types';

type ViewKind = 'tree' | 'radial' | 'timeline';
type Drawer = { type: 'profile' | 'member' | 'settings' | 'family' | 'familyPicker' | 'chat'; id?: string } | null;

export function DesktopWorkspace() {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { activeTreeId, activeFamily } = useFamily();
  const { members, relationships, treeMetadata } = useFamilyTree(activeTreeId);

  const [view, setView] = useState<ViewKind>('tree');
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [focusId, setFocusId] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [zoomApi, setZoomApi] = useState<ZoomApi | null>(null);

  const adjacency = useMemo(() => buildAdjacency(members, relationships), [members, relationships]);
  const meId = useMemo(() => members.find((m) => m.associatedUserId === user?.uid)?.id, [members, user]);
  const gens = useMemo(() => (members.length ? Math.max(...computeGenerations(members, relationships).values()) + 1 : 0), [members, relationships]);

  useEffect(() => { if (!focusId && members.length) setFocusId(meId ?? members[0].id); }, [members, meId, focusId]);
  useEffect(() => { setFocusId(''); setDrawer(null); }, [activeTreeId]);
  useEffect(() => { setZoomApi(null); }, [view]); // active view re-registers its zoom

  const matches = query.trim() ? members.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6) : [];

  const openProfile = (m: Member) => setDrawer({ type: 'profile', id: m.id });
  const editMember = (id?: string) => setDrawer({ type: 'member', id });

  async function saveMember(data: Omit<Member, 'id'>, id?: string) {
    if (!activeTreeId) return;
    setSaving(true);
    try { if (id) await updateMember(activeTreeId, id, data); else await addMember(activeTreeId, data); setDrawer(null); }
    finally { setSaving(false); }
  }
  async function removeMember(id: string) {
    if (!activeTreeId) return;
    const ok = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.confirm('Delete this member and their relationship links?'));
    if (!ok) return;
    setSaving(true);
    try {
      const edges = relationships.filter((r) => r.fromId === id || r.toId === id);
      await Promise.all(edges.map((r) => deleteRelationship(activeTreeId, r.id)));
      await deleteMember(activeTreeId, id);
      setDrawer(null);
    } finally { setSaving(false); }
  }

  const shared = { members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile: openProfile };

  if (!activeTreeId || !focusId) {
    return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* TOP TOOLBAR */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.lineSoft, zIndex: 30 }}>
        <FamilySwitcher c={c} onPick={() => setDrawer({ type: 'familyPicker' })} family={activeFamily} fallbackName={treeMetadata?.name} />

        <View style={{ flex: 1, alignItems: 'center' }}>
          <ViewSwitcher c={c} value={view} onChange={setView} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 200 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 42, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.md }}>
              <Icon name="search" size={17} color={c.mute} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Search family…" placeholderTextColor={c.mute}
                style={{ flex: 1, color: c.ink, fontFamily: font.sansMed, fontSize: 14, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
            </View>
            {matches.length > 0 && (
              <GlassSurface rounded={radius.lg} style={{ position: 'absolute', top: 48, left: 0, right: 0, zIndex: 50, padding: 6 }}>
                {matches.map((m) => (
                  <Pressable key={m.id} onPress={() => { setFocusId(m.id); setQuery(''); openProfile(m); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.sm, backgroundColor: pressed ? c.accentSoft : 'transparent' })}>
                    <Avatar m={m} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 13.5 }}>{m.name}</Text>
                      <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5 }}>{lifespan(m)}</Text>
                    </View>
                  </Pressable>
                ))}
              </GlassSurface>
            )}
          </View>
          <IconBtn name="scan" tone="ghost" onPress={() => router.push('/facematch')} />
          <IconBtn name="users" tone="ghost" onPress={() => setDrawer({ type: 'family' })} />
          <IconBtn name="settings" tone="ghost" onPress={() => setDrawer({ type: 'settings' })} />
          <ThemeToggle />
          <Pressable onPress={() => setDrawer({ type: 'chat' })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <Icon name="sparkles" size={17} color={c.inkSoft} />
            <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 13.5 }}>Ask AI</Text>
          </Pressable>
          <Pressable onPress={() => editMember()} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, height: 42, borderRadius: radius.md, backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <Icon name="plus" size={17} stroke={2.2} color={c.accentInk} />
            <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14 }}>Add</Text>
          </Pressable>
        </View>
      </View>

      {/* SUB BAR — live counts + context label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.lineSoft }}>
        <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase' }}>
          {view === 'radial' ? `Radial — kinship around ${adjacency.get(focusId)?.name ?? ''}`
            : view === 'timeline' ? 'Timeline — lifespans across the decades'
            : 'Tree — pyramid · ancestors · hourglass'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 7, height: 7, borderRadius: 9, backgroundColor: activeFamily?.color ?? c.accent }} />
            <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11.5 }}>{members.length} people · {gens} generations</Text>
          </View>
          {/* shared zoom — drives whichever view is active */}
          <SubBarZoom api={zoomApi} />
        </View>
      </View>

      {/* CANVAS + DRAWER — drawer is confined here (not the whole workspace) so
          the top toolbar stays visible and clickable while a panel is open. */}
      <View style={{ flex: 1 }}>
        {view === 'tree' && <TreeView {...shared} onZoomReady={setZoomApi} hideZoomUI />}
        {view === 'radial' && <RadialView {...shared} onZoomReady={setZoomApi} hideZoomUI />}
        {view === 'timeline' && <TimelineView {...shared} onZoomReady={setZoomApi} hideZoomUI />}

        {/* RIGHT DRAWER */}
        <DesktopDrawer open={!!drawer} onClose={() => setDrawer(null)}>
        {drawer?.type === 'profile' && drawer.id ? (
          <DesktopProfile adj={adjacency} id={drawer.id} meId={meId} onClose={() => setDrawer(null)}
            onEdit={(id) => editMember(id)} onOpen={(id) => setDrawer({ type: 'profile', id })}
            onAddRelative={() => editMember()} onFocusInTree={(id) => { setFocusId(id); setView('tree'); setDrawer(null); }} />
        ) : null}
        {drawer?.type === 'member' ? (
          <MemberForm initial={drawer.id ? adjacency.get(drawer.id) : undefined} saving={saving}
            onSubmit={(data) => saveMember(data, drawer.id)} onCancel={() => setDrawer(null)}
            onDelete={drawer.id ? () => removeMember(drawer.id!) : undefined} />
        ) : null}
        {drawer?.type === 'settings' ? <SettingsPanel onClose={() => setDrawer(null)} /> : null}
        {drawer?.type === 'family' && activeTreeId ? (
          <FamilyInfoPanel treeId={activeTreeId} family={activeFamily} members={members} relationships={relationships} onClose={() => setDrawer(null)} />
        ) : null}
        {drawer?.type === 'familyPicker' ? (
          <FamilyPickerPanel onClose={() => setDrawer(null)} onOpenInfo={() => setDrawer({ type: 'family' })} />
        ) : null}
        {drawer?.type === 'chat' ? (
          <ChatPanel members={members} relationships={relationships} onOpenMember={(m) => setDrawer({ type: 'profile', id: m.id })} onClose={() => setDrawer(null)} />
        ) : null}
        </DesktopDrawer>
      </View>
    </View>
  );
}

function ViewSwitcher({ c, value, onChange }: { c: Palette; value: ViewKind; onChange: (v: ViewKind) => void }) {
  const opts: [ViewKind, string, IconName][] = [['radial', 'Radial', 'radial'], ['timeline', 'Timeline', 'timeline'], ['tree', 'Tree', 'tree']];
  return (
    <View style={{ flexDirection: 'row', padding: 4, gap: 2, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.pill }}>
      {opts.map(([k, lb, ic]) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 17, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: on ? c.accent : 'transparent', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <Icon name={ic} size={17} stroke={1.8} color={on ? c.accentInk : c.inkSoft} />
            <Text style={{ color: on ? c.accentInk : c.inkSoft, fontFamily: font.sansSemi, fontSize: 14 }}>{lb}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FamilySwitcher({ c, family, fallbackName, onPick }: { c: Palette; family: ReturnType<typeof useFamily>['activeFamily']; fallbackName?: string; onPick: () => void }) {
  const name = family?.name ?? fallbackName ?? 'My Family';
  const color = family?.color ?? c.accent;
  const mono = family?.mono ?? (name[0]?.toUpperCase() ?? 'F');
  return (
    <Pressable onPress={onPick} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 220, paddingVertical: 6, paddingRight: 10, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper, borderWidth: 1.5, borderColor: color }}>
        <Text style={{ color, fontFamily: font.serif, fontSize: 19 }}>{mono}</Text>
      </View>
      <View style={{ minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 20 }}>{name}</Text>
          <Icon name="chevD" size={15} color={c.mute} />
        </View>
        <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5, textTransform: 'capitalize' }}>{family?.role ?? 'member'}</Text>
      </View>
    </Pressable>
  );
}

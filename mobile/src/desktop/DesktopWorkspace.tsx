// Responsive desktop workspace (web, wide viewports) — the design's DesktopApp.
// A tree-first canvas with a top toolbar (family switcher · view switcher ·
// search · tools), a sub-bar with live counts, and a right detail drawer that
// hosts the profile / member form / settings / family info / chat. Reuses the
// same visualizers and panels as mobile.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../firebase/AuthContext';
import { useFamily } from '../firebase/FamilyContext';
import { useFamilyTree } from '../firebase/useFamilyTree';
import { addMember, updateMember, deleteMember, deleteRelationship, deleteRelationships, addRelationships, claimMember } from '../firebase/firestore';
import { useUserProfile } from '../firebase/UserProfileContext';
import { PROFILE_TO_MEMBER_FIELDS } from '../firebase/userProfile';
import { reconcileFamilyIndex } from '../firebase/families';
import { planUnlink, type LinkKind } from '../shared/relationshipActions';
import { buildAdjacency, computeGenerations, lifespan } from '../shared/adjacency';
import { useTheme, font, radius, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Avatar, IconBtn, ThemeToggle, SegTabs, SlideSwap } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { TreeView } from '../viz/TreeView';
import { RadialView } from '../viz/RadialView';
import { TimelineView } from '../viz/TimelineView';
import { NetworkView } from '../viz/NetworkView';
import { SubBarZoom, type ZoomApi } from '../viz/vizChrome';
import { DesktopDrawer } from './DesktopDrawer';
import { DesktopProfile } from './DesktopProfile';
import { MemberForm } from '../components/MemberForm';
import { SettingsPanel } from '../components/SettingsPanel';
import { FamilyInfoPanel } from '../components/FamilyInfoPanel';
import { FamilyPhotoFlow } from '../components/FamilyPhotoFlow';
import { EventsPanel } from '../components/EventsPanel';
import { CalendarPanel } from '../components/CalendarPanel';
import { MasterEditGrid } from '../components/MasterEditGrid';
import { FamilyPickerPanel } from '../components/FamilyPickerPanel';
import { ChatPanel } from '../components/ChatPanel';
import { MembersPanel } from '../components/MembersPanel';
import { ExportPanel } from '../components/ExportPanel';
import { LinkForm } from '../components/LinkForm';
import { canEditMember, canDeleteMember, canEditRelationship, canImport, canManageData } from '../shared/permissions';
import type { Member, Relationship } from '../shared/types';

type ViewKind = 'tree' | 'radial' | 'timeline' | 'network' | 'master';
type Drawer = { type: 'profile' | 'member' | 'settings' | 'family' | 'familyPicker' | 'familyPhoto' | 'events' | 'calendar' | 'chat' | 'members' | 'export' | 'link'; id?: string; kind?: LinkKind } | null;

export function DesktopWorkspace() {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const profile = useUserProfile();
  const { activeTreeId, activeFamily } = useFamily();
  const { members, relationships, events, treeMetadata } = useFamilyTree(activeTreeId);

  const [view, setView] = useState<ViewKind>('tree');
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [focusId, setFocusId] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [zoomApi, setZoomApi] = useState<ZoomApi | null>(null);

  const adjacency = useMemo(() => buildAdjacency(members, relationships), [members, relationships]);
  const meId = useMemo(() => members.find((m) => m.associatedUserId === user?.uid)?.id, [members, user]);
  const role = activeFamily?.role;
  const gens = useMemo(() => (members.length ? Math.max(...computeGenerations(members, relationships).values()) + 1 : 0), [members, relationships]);

  useEffect(() => { if (!focusId && members.length) setFocusId(meId ?? members[Math.floor(Math.random() * members.length)].id); }, [members, meId, focusId]);
  useEffect(() => { setFocusId(''); setDrawer(null); }, [activeTreeId]);
  // Heal a stale switcher-index name against the live tree-doc name.
  useEffect(() => {
    if (!user || !activeTreeId || !treeMetadata?.name || !activeFamily) return;
    if (treeMetadata.name !== activeFamily.name) {
      reconcileFamilyIndex(user.uid, activeTreeId, { name: treeMetadata.name, color: activeFamily.color });
    }
  }, [treeMetadata?.name, activeFamily?.name, activeFamily?.color, activeTreeId, user]);
  // Don't blanket-reset zoomApi on view change: child effects run BEFORE parent
  // effects, so the incoming view registers its api first and a reset here would
  // null it right back — leaving the sub-bar zoom permanently disabled. Only the
  // master edit grid (no canvas) clears it; a swapped-out view's stale closures
  // are safe no-ops (`canvasRef.current?.`) until the next view re-registers.
  useEffect(() => { if (view === 'master') setZoomApi(null); }, [view]);

  const matches = query.trim() ? members.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6) : [];

  const openProfile = (m: Member) => setDrawer({ type: 'profile', id: m.id });
  const editMember = (id?: string) => setDrawer({ type: 'member', id });

  async function saveMember(data: Omit<Member, 'id'>, id?: string) {
    if (!activeTreeId) return;
    if (id && !canEditMember(role, adjacency.get(id), user?.uid)) return; // not your node
    setSaving(true);
    try { if (id) await updateMember(activeTreeId, id, data); else await addMember(activeTreeId, data); setDrawer(null); }
    finally { setSaving(false); }
  }
  async function removeMember(id: string) {
    if (!activeTreeId || !canDeleteMember(role)) return;
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

  // Add relationship edges (with the same depth-1 guard as the mobile /link route).
  async function addLink(edges: Omit<Relationship, 'id'>[]) {
    if (!activeTreeId) return;
    if (!edges.every((e) => canEditRelationship(role, e.fromId, e.toId, members, user?.uid))) return;
    setSaving(true);
    try { await addRelationships(activeTreeId, edges); setDrawer(null); }
    finally { setSaving(false); }
  }
  // Remove a relationship (direct edges + now-unsupported inferred siblings).
  function removeLink(focusMemberId: string, kind: LinkKind, relatedId: string) {
    if (!activeTreeId) return;
    if (!canEditRelationship(role, focusMemberId, relatedId, members, user?.uid)) return;
    const plan = planUnlink(members, relationships, focusMemberId, relatedId, kind);
    if (!plan.ids.length) return;
    const other = adjacency.get(relatedId)?.name ?? 'this person';
    const ok = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.confirm(`Remove the link between ${adjacency.get(focusMemberId)?.name ?? 'this person'} and ${other}?`));
    if (!ok) return;
    deleteRelationships(activeTreeId, plan.ids);
  }
  // Claim a node as "this is me" (only offered when the user has no node yet).
  function claimThis(memberId: string) {
    if (!activeTreeId || !user) return;
    const name = adjacency.get(memberId)?.name ?? 'this person';
    const ok = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.confirm(`Set ${name} as you? You'll get the “You” badge and can edit this profile.`));
    if (!ok) return;
    claimMember(activeTreeId, memberId, user.uid);
  }
  // One-way push of the signed-in user's profile details onto their own node.
  function syncProfile(memberId: string) {
    if (!activeTreeId || !profile) return;
    const name = adjacency.get(memberId)?.name ?? 'this person';
    const patch: Partial<Member> = {};
    for (const f of PROFILE_TO_MEMBER_FIELDS) { const v = (profile as any)[f]; if (v !== undefined && v !== null && v !== '') (patch as any)[f] = v; }
    if (!Object.keys(patch).length) return;
    const ok = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.confirm(`Copy your profile details onto ${name}? This overwrites their name, photo, dates, contact, and bio with your profile.`));
    if (!ok) return;
    updateMember(activeTreeId, memberId, patch);
  }

  const shared = { members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile: openProfile };

  // Active family still resolving — brief spinner, never a blank canvas.
  if (!activeTreeId) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* TOP TOOLBAR */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.lineSoft, zIndex: 30 }}>
        <FamilySwitcher c={c} onPick={() => setDrawer({ type: 'family' })} family={activeFamily} fallbackName={treeMetadata?.name} />

        <View style={{ flex: 1, alignItems: 'center' }}>
          <ViewSwitcher value={view} onChange={setView} />
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
          <IconBtn name="users" tone="ghost" onPress={() => setDrawer({ type: 'members' })} />
          <IconBtn name="calendar" tone="ghost" onPress={() => setDrawer({ type: 'calendar' })} />
          <IconBtn name="download" tone="ghost" onPress={() => setDrawer({ type: 'export' })} />
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
            : view === 'network' ? 'Network — force-directed relationship graph'
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
        {view === 'master' ? (
          <MasterEditGrid treeId={activeTreeId} members={members} canManage={canManageData(role)} onClose={() => setView('tree')} />
        ) : members.length === 0 ? (
          <EmptyCanvas c={c} family={activeFamily} onAddFirst={() => editMember()} onPickFamily={() => setDrawer({ type: 'familyPicker' })} />
        ) : !focusId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>
        ) : (
          <SlideSwap activeKey={view} index={['radial', 'timeline', 'tree', 'network'].indexOf(view)} style={{ flex: 1 }}>
            {view === 'tree' ? <TreeView {...shared} onZoomReady={setZoomApi} hideZoomUI />
              : view === 'radial' ? <RadialView {...shared} onZoomReady={setZoomApi} hideZoomUI />
              : view === 'network' ? <NetworkView {...shared} onZoomReady={setZoomApi} hideZoomUI />
              : <TimelineView {...shared} events={events} onZoomReady={setZoomApi} hideZoomUI />}
          </SlideSwap>
        )}

        {/* RIGHT DRAWER */}
        <DesktopDrawer open={!!drawer} onClose={() => setDrawer(null)}>
        {drawer?.type === 'profile' && drawer.id ? (
          <DesktopProfile adj={adjacency} id={drawer.id} meId={meId} onClose={() => setDrawer(null)}
            canEdit={canEditMember(role, adjacency.get(drawer.id), user?.uid)}
            canAddRelative={canEditRelationship(role, drawer.id, drawer.id, members, user?.uid)}
            canClaim={!meId && !adjacency.get(drawer.id)?.associatedUserId}
            canSync={!!meId && drawer.id === meId && !!profile}
            onEdit={(id) => editMember(id)} onOpen={(id) => setDrawer({ type: 'profile', id })}
            onAddRelative={(kind) => setDrawer({ type: 'link', id: drawer.id, kind })}
            onDeleteRelative={(kind, relatedId) => removeLink(drawer.id!, kind, relatedId)}
            onClaim={() => claimThis(drawer.id!)}
            onSync={() => syncProfile(drawer.id!)}
            onFocusInTree={(id) => { setFocusId(id); setView('tree'); setDrawer(null); }} />
        ) : null}
        {drawer?.type === 'link' ? (
          <LinkForm members={members} relationships={relationships} presetAId={drawer.id} presetKind={drawer.kind}
            saving={saving} onSubmit={addLink} onCancel={() => setDrawer(drawer.id ? { type: 'profile', id: drawer.id } : null)} />
        ) : null}
        {drawer?.type === 'member' ? (
          <MemberForm initial={drawer.id ? adjacency.get(drawer.id) : undefined} saving={saving}
            onSubmit={(data) => saveMember(data, drawer.id)} onCancel={() => setDrawer(null)}
            onDelete={drawer.id && canDeleteMember(role) ? () => removeMember(drawer.id!) : undefined} />
        ) : null}
        {drawer?.type === 'settings' ? <SettingsPanel onClose={() => setDrawer(null)} onOpenCalendar={() => setDrawer({ type: 'calendar' })} /> : null}
        {drawer?.type === 'calendar' ? (
          <CalendarPanel members={members} relationships={relationships} events={events}
            treeName={activeFamily?.name ?? treeMetadata?.name} onClose={() => setDrawer(null)} />
        ) : null}
        {drawer?.type === 'family' && activeTreeId ? (
          <FamilyInfoPanel treeId={activeTreeId} family={activeFamily} members={members} relationships={relationships}
            onClose={() => setDrawer(null)} onSwitchFamily={() => setDrawer({ type: 'familyPicker' })}
            onUploadPhoto={() => setDrawer({ type: 'familyPhoto' })} onOpenEvents={() => setDrawer({ type: 'events' })}
            onOpenMasterEdit={() => { setDrawer(null); setView('master'); }} />
        ) : null}
        {drawer?.type === 'familyPhoto' && activeTreeId ? (
          <FamilyPhotoFlow treeId={activeTreeId} members={members} onClose={() => setDrawer(null)} />
        ) : null}
        {drawer?.type === 'events' && activeTreeId ? (
          <EventsPanel treeId={activeTreeId} members={members} events={events} canManage={canManageData(role)} onClose={() => setDrawer(null)} />
        ) : null}
        {drawer?.type === 'familyPicker' ? (
          <FamilyPickerPanel onClose={() => setDrawer(null)} onOpenInfo={() => setDrawer({ type: 'family' })} />
        ) : null}
        {drawer?.type === 'chat' ? (
          <ChatPanel members={members} relationships={relationships} sessionKey={activeTreeId ?? 'default'} onOpenMember={(m) => setDrawer({ type: 'profile', id: m.id })} onClose={() => setDrawer(null)} />
        ) : null}
        {drawer?.type === 'members' ? (
          <MembersPanel members={members} meId={meId} onOpenProfile={openProfile} onOpenFamilyInfo={() => setDrawer({ type: 'family' })} onClose={() => setDrawer(null)} />
        ) : null}
        {drawer?.type === 'export' && activeTreeId ? (
          <ExportPanel treeId={activeTreeId} members={members} relationships={relationships} treeName={activeFamily?.name ?? treeMetadata?.name} focusId={focusId} canImport={canImport(role)} onClose={() => setDrawer(null)} />
        ) : null}
        </DesktopDrawer>
      </View>
    </View>
  );
}

// Shown when the active family has no members yet (e.g. a brand-new account).
// Replaces the old blank canvas with a welcome + first-step call to action.
function EmptyCanvas({ c, family, onAddFirst, onPickFamily }: {
  c: Palette; family: ReturnType<typeof useFamily>['activeFamily'];
  onAddFirst: () => void; onPickFamily: () => void;
}) {
  const name = family?.name ?? 'your family';
  const color = family?.color ?? c.accent;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <GlassSurface rounded={radius.xl} style={{ width: '100%', maxWidth: 520 }}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft, borderWidth: 1.5, borderColor: color, marginBottom: 22 }}>
            <Icon name="tree" size={38} stroke={1.5} color={color} />
          </View>
          <Text style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 30, lineHeight: 34, textAlign: 'center' }}>Start your family tree</Text>
          <Text style={{ color: c.mute, fontFamily: font.sansMed, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 380 }}>
            {name} has no one yet. Add your first person, then connect parents, partners, and children.
          </Text>
          <Pressable onPress={onAddFirst} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, height: 48, borderRadius: radius.md, backgroundColor: c.accent, marginTop: 26, shadowColor: c.accent, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <Icon name="plus" size={19} stroke={2.2} color={c.accentInk} />
            <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Add your first member</Text>
          </Pressable>
          <Pressable onPress={onPickFamily} style={({ pressed }) => ({ marginTop: 16, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 13.5 }}>Create or join another family</Text>
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  );
}

function ViewSwitcher({ value, onChange }: { value: ViewKind; onChange: (v: ViewKind) => void }) {
  return (
    <SegTabs<ViewKind>
      value={value} onChange={onChange}
      options={[['radial', 'Radial'], ['timeline', 'Timeline'], ['tree', 'Tree'], ['network', 'Network']]}
      icons={{ radial: 'radial', timeline: 'timeline', tree: 'tree', network: 'link' }}
      fill={false} fontSize={14} />
  );
}

function FamilySwitcher({ c, family, fallbackName, onPick }: { c: Palette; family: ReturnType<typeof useFamily>['activeFamily']; fallbackName?: string; onPick: () => void }) {
  // Live tree-doc name (fallbackName) wins over the denormalised index so a
  // rename shows immediately for every collaborator, not just the editor.
  const name = fallbackName ?? family?.name ?? 'My Family';
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

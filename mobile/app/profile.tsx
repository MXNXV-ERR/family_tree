// Member profile (Phase 3, req 3). Glass header + 3 tabs: Info (contact +
// basics, with tappable phone/email), Relations (parents/partners/children/
// siblings as chips → open their profile), Story (quote/childhood/about/notes/
// custom). Edit button → member form. Quick actions add a relative via the
// Link dialog preset to this person.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Linking, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { canEditMember, canEditRelationship, myMemberId } from '../src/shared/permissions';
import { planUnlink, type LinkKind } from '../src/shared/relationshipActions';
import { deleteRelationships, claimMember, updateMember } from '../src/firebase/firestore';
import { splitId, nsId } from '../src/firebase/masters';
import { useUserProfile } from '../src/firebase/UserProfileContext';
import { PROFILE_TO_MEMBER_FIELDS } from '../src/firebase/userProfile';
import { useTheme, radius, space, font, type Palette } from '../src/theme/theme';
import { useSettings } from '../src/theme/SettingsContext';
import { GlassSurface } from '../src/theme/GlassSurface';
import { Icon } from '../src/ui/Icon';
import { Rise, Fade } from '../src/ui/primitives';
import { buildAdjacency, initials, lifespan } from '../src/shared/adjacency';
import type { Member } from '../src/shared/types';

type Tab = 'info' | 'relations' | 'story';

export default function Profile() {
  const { c } = useTheme();
  const { years } = useSettings();
  const { user } = useAuth();
  const { activeTreeId, activeFamily, families } = useFamily();
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const [tab, setTab] = useState<Tab>('info');
  // A master (combined) view passes a namespaced `treeId:localId`; read + write
  // against the ORIGIN tree, and keep in-profile navigation namespaced so
  // browsing relatives stays in the combined context.
  const split = rawId ? splitId(rawId) : null;
  const treeId = split ? split.treeId : activeTreeId;
  const localId = split ? split.localId : rawId;
  const role = split ? families.find((f) => f.id === treeId)?.role : activeFamily?.role;
  const nav = (lid: string) => (split && treeId ? nsId(treeId, lid) : lid);
  const { members, relationships, loading } = useFamilyTree(treeId);

  const adj = useMemo(() => buildAdjacency(members, relationships), [members, relationships]);
  const m = localId ? members.find((x) => x.id === localId) : undefined;
  const canEdit = canEditMember(role, m, user?.uid);
  const canLink = !!m && canEditRelationship(role, m.id, m.id, members, user?.uid);
  const myId = myMemberId(members, user?.uid);
  const profile = useUserProfile();

  // Remove a relationship (direct edges + now-unsupported inferred siblings).
  const removeLink = (kind: string, relatedId: string) => {
    if (!m || !treeId) return;
    const plan = planUnlink(members, relationships, m.id, relatedId, kind as LinkKind);
    if (!plan.ids.length) return;
    const other = members.find((x) => x.id === relatedId)?.name ?? 'this person';
    const msg = `Remove the link between ${m.name} and ${other}?`;
    const go = () => { deleteRelationships(treeId, plan.ids); };
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) go(); }
    else Alert.alert('Remove link', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: go }]);
  };

  // Claim this node as "this is me" (only when the user has no node yet).
  const claimThis = () => {
    if (!m || !treeId || !user) return;
    const msg = `Set ${m.name} as you? You'll get the “You” badge and can edit this profile.`;
    const go = () => { claimMember(treeId, m.id, user.uid); };
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) go(); }
    else Alert.alert('This is me', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes', onPress: go }]);
  };

  // One-way push: copy the signed-in user's profile details onto their own node.
  const syncProfile = () => {
    if (!m || !treeId || !profile) return;
    const patch: Partial<Member> = {};
    for (const f of PROFILE_TO_MEMBER_FIELDS) {
      const v = (profile as any)[f];
      if (v !== undefined && v !== null && v !== '') (patch as any)[f] = v;
    }
    if (!Object.keys(patch).length) return;
    const go = () => { updateMember(treeId, m.id, patch); };
    const msg = `Copy your profile details onto ${m.name}? This overwrites their name, photo, dates, contact, and bio with your profile.`;
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) go(); }
    else Alert.alert('Sync my profile', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Sync', onPress: go }]);
  };

  if (loading) {
    return <Center c={c}><ActivityIndicator color={c.accent} /></Center>;
  }
  if (!m) {
    return <Center c={c}><Text style={{ color: c.mute }}>Member not found.</Text></Center>;
  }

  const av = m.gender === 'female' ? c.cardF : m.gender === 'other' ? c.paper : c.cardM;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="back" size={18} color={c.accent} />
            <Text style={{ color: c.accent, fontWeight: '600' }}>Back</Text>
          </View>
        </Pressable>

        {/* Header */}
        <Rise i={0}>
        <GlassSurface rounded={radius.xl} style={{ marginBottom: 16 }}>
          <View style={{ padding: space(5), alignItems: 'center' }}>
            <View style={[styles.avatar, { backgroundColor: av, borderColor: c.line }]}>
              {m.photoUrl ? <Image source={{ uri: m.photoUrl }} style={styles.avatarImg} /> :
                <Text style={{ color: c.inkSoft, fontWeight: '800', fontSize: 30 }}>{initials(m.name)}</Text>}
            </View>
            <Text style={[styles.name, { color: c.ink }]}>{m.name}</Text>
            {years ? <Text style={{ color: c.mute, marginTop: 2 }}>{lifespan(m)}</Text> : null}
            {m.occupation ? <Text style={{ color: c.inkSoft, marginTop: 2 }}>{m.occupation}</Text> : null}
            {m.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Icon name="pin" size={13} color={c.mute} />
                <Text style={{ color: c.mute, fontSize: 13 }}>{m.location}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {canEdit ? (
                <Pressable onPress={() => router.push({ pathname: '/member', params: { id: nav(m.id) } })} style={[styles.editBtn, { borderColor: c.accent, marginTop: 0 }]}>
                  <Text style={{ color: c.accent, fontWeight: '700' }}>Edit</Text>
                </Pressable>
              ) : null}
              {!myId && !m.associatedUserId ? (
                <Pressable onPress={claimThis} style={[styles.editBtn, { borderColor: c.accent, backgroundColor: c.accentSoft, marginTop: 0 }]}>
                  <Text style={{ color: c.accent, fontWeight: '700' }}>This is me</Text>
                </Pressable>
              ) : null}
              {myId && m.id === myId && profile ? (
                <Pressable onPress={syncProfile} style={[styles.editBtn, { borderColor: c.accent, marginTop: 0 }]}>
                  <Text style={{ color: c.accent, fontWeight: '700' }}>Sync my profile</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </GlassSurface>
        </Rise>

        {/* Tabs */}
        <View style={[styles.tabbar, { backgroundColor: c.paper, borderColor: c.line }]}>
          {(['info', 'relations', 'story'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, on && { backgroundColor: c.accentSoft }]}>
                <Text style={{ color: on ? c.accent : c.inkSoft, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <Fade trigger={tab}>
          {tab === 'info' && <InfoTab m={m} c={c} />}
          {tab === 'relations' && <RelationsTab m={m} adj={adj} c={c} canAdd={canLink} canDelete={canLink} onDelete={removeLink} onOpen={(rid) => router.push({ pathname: '/profile', params: { id: nav(rid) } })} onAdd={(kind) => router.push({ pathname: '/link', params: { a: nav(m.id), kind } })} />}
          {tab === 'story' && <StoryTab m={m} c={c} />}
        </Fade>
      </ScrollView>
    </View>
  );
}

function InfoTab({ m, c }: { m: Member; c: Palette }) {
  const rows: { label: string; value?: string; action?: () => void; actionLabel?: string }[] = [
    { label: 'Phone', value: m.phone, action: m.phone ? () => Linking.openURL(`tel:${m.phone}`) : undefined, actionLabel: 'Call' },
    { label: 'Email', value: m.email, action: m.email ? () => Linking.openURL(`mailto:${m.email}`) : undefined, actionLabel: 'Mail' },
    { label: 'Address', value: m.address },
    { label: 'Born', value: m.birthDate },
    { label: 'Died', value: m.deathDate },
    { label: 'Place of birth', value: m.placeOfBirth },
    { label: 'Maiden name', value: m.maidenName },
    { label: 'Gender', value: m.gender },
  ].filter((r) => r.value);

  if (!rows.length) return <Empty c={c} text="No contact or basic details yet." />;
  return (
    <GlassSurface>
      <View style={{ padding: space(4) }}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.infoRow, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.lineSoft }]}>
            <Text style={{ color: c.mute, fontSize: 13, width: 110 }}>{r.label}</Text>
            <Text style={{ color: c.ink, flex: 1, textTransform: r.label === 'Gender' ? 'capitalize' : 'none' }}>{r.value}</Text>
            {r.action ? (
              <Pressable onPress={r.action} style={[styles.chip, { borderColor: c.accent }]}>
                <Text style={{ color: c.accent, fontWeight: '600', fontSize: 12 }}>{r.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}

function RelationsTab({ m, adj, c, canAdd, canDelete, onOpen, onAdd, onDelete }: {
  m: Member; adj: ReturnType<typeof buildAdjacency>; c: Palette; canAdd: boolean; canDelete: boolean;
  onOpen: (id: string) => void; onAdd: (kind: string) => void; onDelete: (kind: string, relatedId: string) => void;
}) {
  const groups: { title: string; ids: string[]; addKind: string }[] = [
    { title: 'Parents', ids: adj.parents(m.id), addKind: 'child' },
    { title: 'Partners', ids: [...adj.currentSpouses(m.id), ...adj.exSpouses(m.id)], addKind: 'spouse' },
    { title: 'Children', ids: adj.children(m.id), addKind: 'parent' },
    { title: 'Siblings', ids: adj.siblings(m.id), addKind: 'sibling' },
  ];
  return (
    <View>
      {groups.map((g) => (
        <GlassSurface key={g.title} style={{ marginBottom: 12 }}>
          <View style={{ padding: space(4) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.section, { color: c.mute }]}>{g.title.toUpperCase()}</Text>
              {canAdd ? (
                <Pressable onPress={() => onAdd(g.addKind)} hitSlop={8}>
                  <Text style={{ color: c.accent, fontWeight: '700', fontSize: 13 }}>+ Add</Text>
                </Pressable>
              ) : null}
            </View>
            {g.ids.length === 0 ? (
              <Text style={{ color: c.mute, fontSize: 13 }}>None recorded.</Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {g.ids.map((rid) => {
                  const p = adj.get(rid);
                  if (!p) return null;
                  const ex = g.title === 'Partners' && adj.exSpouses(m.id).includes(rid);
                  return (
                    <Pressable key={rid} onPress={() => onOpen(rid)} style={[styles.personChip, { borderColor: c.line, backgroundColor: c.paper }]}>
                      <View style={[styles.chipAv, { backgroundColor: p.gender === 'female' ? c.cardF : c.cardM }]}>
                        <Text style={{ color: c.inkSoft, fontWeight: '700', fontSize: 10 }}>{initials(p.name)}</Text>
                      </View>
                      <Text style={{ color: c.ink, fontWeight: '600' }}>{p.name}</Text>
                      {ex ? <Text style={{ color: c.relEx, fontSize: 11 }}>(ex)</Text> : null}
                      {canDelete ? (
                        <Pressable onPress={() => onDelete(g.addKind, rid)} hitSlop={8} style={{ marginLeft: 1 }}>
                          <Icon name="close" size={14} color={c.mute} />
                        </Pressable>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </GlassSurface>
      ))}
    </View>
  );
}

function StoryTab({ m, c }: { m: Member; c: Palette }) {
  const blocks: { label: string; value?: string }[] = [
    { label: 'Favorite quote', value: m.favoriteQuote },
    { label: 'About', value: m.about },
    { label: 'Childhood stories', value: m.childhoodStories },
    { label: 'Notes', value: m.notes },
  ].filter((b) => b.value);
  const custom = Object.entries(m.customFields ?? {});

  if (!blocks.length && !custom.length) return <Empty c={c} text="No story or notes yet." />;
  return (
    <View>
      {blocks.map((b) => (
        <GlassSurface key={b.label} style={{ marginBottom: 12 }}>
          <View style={{ padding: space(4) }}>
            <Text style={[styles.section, { color: c.mute, marginBottom: 6 }]}>{b.label.toUpperCase()}</Text>
            <Text style={{ color: c.ink, lineHeight: 21, fontStyle: b.label === 'Favorite quote' ? 'italic' : 'normal' }}>
              {b.label === 'Favorite quote' ? `“${b.value}”` : b.value}
            </Text>
          </View>
        </GlassSurface>
      ))}
      {custom.length ? (
        <GlassSurface style={{ marginBottom: 12 }}>
          <View style={{ padding: space(4) }}>
            <Text style={[styles.section, { color: c.mute, marginBottom: 6 }]}>MORE</Text>
            {custom.map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', paddingVertical: 5 }}>
                <Text style={{ color: c.mute, fontSize: 13, width: 120 }}>{k}</Text>
                <Text style={{ color: c.ink, flex: 1 }}>{v}</Text>
              </View>
            ))}
          </View>
        </GlassSurface>
      ) : null}
    </View>
  );
}

const Center = ({ c, children }: { c: Palette; children: React.ReactNode }) => (
  <View style={{ flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
);
const Empty = ({ c, text }: { c: Palette; text: string }) => (
  <GlassSurface><Text style={{ color: c.mute, textAlign: 'center', padding: 28 }}>{text}</Text></GlassSurface>
);

const styles = StyleSheet.create({
  avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  name: { fontSize: 27, fontFamily: font.serifItalic, marginTop: 12, textAlign: 'center' },
  editBtn: { marginTop: 14, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 28, paddingVertical: 8 },
  tabbar: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, padding: 4, marginBottom: 14, gap: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 8 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: radius.pill, paddingLeft: 4, paddingRight: 12, paddingVertical: 4 },
  chipAv: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});

// Home — rebuilt to the "family tree reimagined" design: family header with
// serif monogram + title, animated theme toggle, Visualize gradient hero,
// animated stat counters, quick-tools row, search, staggered member list, and
// a floating bottom nav with the raised tree button. All emoji → line icons.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform, Modal, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { reconcileFamilyIndex } from '../src/firebase/families';
import { useTheme, radius, space, font, type Palette } from '../src/theme/theme';
import { GlassSurface } from '../src/theme/GlassSurface';
import { useSettings } from '../src/theme/SettingsContext';
import { ChatPanel } from '../src/components/ChatPanel';
import { BottomSheet } from '../src/components/BottomSheet';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { CalendarPanel } from '../src/components/CalendarPanel';
import { FamilyPickerPanel } from '../src/components/FamilyPickerPanel';
import { FamilyInfoPanel } from '../src/components/FamilyInfoPanel';
import { Icon, type IconName } from '../src/ui/Icon';
import { Avatar, IconBtn, SectionLabel, Counter, ThemeToggle, Rise } from '../src/ui/primitives';
import { useResponsive } from '../src/ui/useResponsive';
import { DesktopWorkspace } from '../src/desktop/DesktopWorkspace';
import { lifespan, computeGenerations, countCouples } from '../src/shared/adjacency';
import { remindersSupported, syncReminders } from '../src/notifications/reminders';
import type { Member } from '../src/shared/types';

// On wide web viewports the home route becomes the desktop workspace; phones and
// native always get the mobile home below.
export default function Home() {
  const { isDesktop } = useResponsive();
  const { needsOnboarding, loadingFamilies } = useFamily();
  // Brand-new accounts (no family yet) are routed to Create-or-Join.
  if (!loadingFamilies && needsOnboarding) return <Redirect href="/onboard" />;
  return isDesktop ? <DesktopWorkspace /> : <MobileHome />;
}

function MobileHome() {
  const { c } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const { years, reminders } = useSettings();
  const { activeTreeId, activeFamily, families } = useFamily();
  const { members, relationships, events, treeMetadata, loading } = useFamilyTree(activeTreeId);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [familyInfoOpen, setFamilyInfoOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const openChat = () => { if (Platform.OS === 'web') setChatOpen(true); else router.push('/chat'); };

  const meId = useMemo(() => members.find((m) => m.associatedUserId === user?.uid)?.id, [members, user]);
  const couples = useMemo(() => countCouples(members, relationships), [members, relationships]);
  const gens = useMemo(() => {
    if (!members.length) return 0;
    const g = computeGenerations(members, relationships);
    return Math.max(...g.values()) + 1;
  }, [members, relationships]);

  const shown = query.trim()
    ? members.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()))
    : members;

  // Prefer the LIVE tree doc (treeMetadata) over the denormalised switcher index
  // (activeFamily) so a rename by any user shows immediately for everyone.
  const treeName = treeMetadata?.name ?? activeFamily?.name ?? 'My Family Tree';
  const mono = activeFamily?.mono ?? (treeName.trim().charAt(0).toUpperCase() || 'F');
  const famColor = activeFamily?.color ?? c.accent;
  const famSub = activeFamily?.role
    ? `${activeFamily.role[0].toUpperCase()}${activeFamily.role.slice(1)}${families.length > 1 ? ` · ${families.length} families` : ''}`
    : (user?.email ?? '');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading]);

  // Heal a stale switcher-index name (e.g. a family renamed before the
  // collaborator fan-out existed) using the live tree-doc name.
  useEffect(() => {
    if (!user || !activeTreeId || !treeMetadata?.name || !activeFamily) return;
    if (treeMetadata.name !== activeFamily.name) {
      reconcileFamilyIndex(user.uid, activeTreeId, { name: treeMetadata.name, color: activeFamily.color });
    }
  }, [treeMetadata?.name, activeFamily?.name, activeFamily?.color, activeTreeId, user]);

  // Re-schedule birthday/anniversary reminders whenever the tree data changes
  // (native only; a no-op on web / when the toggle is off). Debounced a little
  // so a burst of snapshot updates doesn't thrash the scheduler.
  useEffect(() => {
    if (!reminders || !remindersSupported || loading || !members.length) return;
    const t = setTimeout(() => { syncReminders(members, relationships); }, 1500);
    return () => clearTimeout(t);
  }, [reminders, members, relationships, loading]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* header */}
        <View style={{ paddingTop: Platform.OS === 'web' ? 18 : 12, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => setFamilyInfoOpen(true)} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft, borderWidth: 1.5, borderColor: famColor }}>
              <Text style={{ color: famColor, fontFamily: font.serifItalic, fontSize: 21 }}>{mono}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 23, lineHeight: 27, letterSpacing: -0.2, flexShrink: 1 }}>{treeName}</Text>
                <Icon name="chevD" size={15} color={c.mute} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                <View style={{ width: 6, height: 6, borderRadius: 9, backgroundColor: c.teal }} />
                <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{famSub}</Text>
              </View>
            </View>
          </Pressable>
          <ThemeToggle />
          <IconBtn name="settings" tone="glass" onPress={() => setSettingsOpen(true)} />
        </View>

        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {/* HERO — the main tool */}
          <Rise i={0}>
            <Pressable onPress={() => router.push('/tree')} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <LinearGradient colors={[c.accent, c.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ borderRadius: radius.xl, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: c.accent, shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.accentInk, opacity: 0.85, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.9, textTransform: 'uppercase' }}>The whole family, at a glance</Text>
                  <Text style={{ color: c.accentInk, fontFamily: font.serifItalic, fontSize: 30, marginTop: 5, marginBottom: 10, lineHeight: 32 }}>Visualize</Text>
                  <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                    <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 13.5 }}>Open tree</Text>
                    <Icon name="chevR" size={15} stroke={2.2} color={c.accentInk} />
                  </View>
                </View>
                <FloatTile c={c} />
              </LinearGradient>
            </Pressable>
          </Rise>

          {/* stats */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {([['Members', members.length], ['Couples', couples], ['Generations', gens]] as [string, number][]).map(([lb, v], i) => (
              <Rise key={lb} i={i + 1} style={{ flex: 1 }}>
                <GlassSurface rounded={18}>
                  <View style={{ padding: 14 }}>
                    {loading
                      ? <Text style={{ color: c.ink, fontFamily: font.serif, fontSize: 30, lineHeight: 32 }}>…</Text>
                      : <Counter value={v} style={{ color: c.ink, fontFamily: font.serif, fontSize: 30, lineHeight: 32 }} />}
                    <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 }}>{lb}</Text>
                  </View>
                </GlassSurface>
              </Rise>
            ))}
          </View>

          {/* quick tools */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 9 }}>
            {([
              ['scan', 'Face match', () => router.push('/facematch')],
              ['sparkles', 'Family AI', openChat],
              ['calendar', 'Calendar', () => setCalendarOpen(true)],
              ['plus', 'Add member', () => router.push('/member')],
              ['link', 'Add link', () => router.push('/link')],
              ['share', 'Export', () => router.push('/export')],
            ] as [IconName, string, () => void][]).map(([ic, lb, fn]) => (
              <Pressable key={lb} onPress={fn} style={({ pressed }) => ({
                flexShrink: 0, alignItems: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 14,
                borderRadius: 16, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, minWidth: 82,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}>
                <Icon name={ic} size={20} color={c.accent} />
                <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 11.5 }}>{lb}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* search */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 50, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: 14 }}>
            <Icon name="search" size={19} color={c.mute} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search family…" placeholderTextColor={c.mute}
              style={{ flex: 1, color: c.ink, fontFamily: font.sansMed, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
            {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Icon name="close" size={17} color={c.mute} /></Pressable> : null}
          </View>

          {/* member list */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <SectionLabel c={c}>{query ? `${shown.length} matches` : 'All members'}</SectionLabel>
            <Pressable onPress={() => router.push('/member')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="plus" size={14} stroke={2.2} color={c.accent} />
              <Text style={{ color: c.accent, fontFamily: font.sansBold, fontSize: 12.5 }}>Add</Text>
            </Pressable>
          </View>
          <View style={{ gap: 8 }}>
            {shown.map((m, i) => (
              <Rise key={m.id} i={i}>
                <Pressable onPress={() => router.push({ pathname: '/profile', params: { id: m.id } })}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderRadius: 15,
                    backgroundColor: c.paper, borderWidth: 1, borderColor: c.line,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}>
                  <Avatar m={m} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 15 }}>{m.name}</Text>
                      {meId === m.id ? (
                        <View style={{ backgroundColor: c.accent, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }}>
                          <Text style={{ color: c.accentInk, fontFamily: font.sansHeavy, fontSize: 8.5 }}>YOU</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 11.5, marginTop: 2 }}>
                      {[years ? lifespan(m) : '', m.occupation].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Icon name="chevR" size={18} color={c.faint} />
                </Pressable>
              </Rise>
            ))}
            {loading && !members.length ? (
              // skeleton rows while the first snapshot loads
              <>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderRadius: 15, backgroundColor: c.paper, borderWidth: 1, borderColor: c.lineSoft, opacity: 0.55 - i * 0.08 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.paper2 }} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <View style={{ width: '55%', height: 12, borderRadius: 6, backgroundColor: c.paper2 }} />
                      <View style={{ width: '35%', height: 9, borderRadius: 5, backgroundColor: c.paper2 }} />
                    </View>
                  </View>
                ))}
              </>
            ) : null}
            {!loading && shown.length === 0 && query.trim() ? (
              <GlassSurface><Text style={{ color: c.mute, fontFamily: font.sansMed, textAlign: 'center', padding: 24 }}>No matches found.</Text></GlassSurface>
            ) : null}
            {!loading && members.length === 0 && !query.trim() ? (
              // first-run nudge — mirror the desktop EmptyCanvas
              <GlassSurface rounded={radius.xl}>
                <View style={{ padding: 26, alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft, borderWidth: 1.5, borderColor: famColor }}>
                    <Icon name="tree" size={30} stroke={1.5} color={famColor} />
                  </View>
                  <Text style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 22, textAlign: 'center' }}>Start your family tree</Text>
                  <Text style={{ color: c.mute, fontFamily: font.sansMed, fontSize: 13.5, lineHeight: 19, textAlign: 'center' }}>
                    Add your first person, then connect parents, partners, and children.
                  </Text>
                  <Pressable onPress={() => router.push('/member')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18, height: 46, borderRadius: radius.md, backgroundColor: c.accent, marginTop: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                    <Icon name="plus" size={17} stroke={2.2} color={c.accentInk} />
                    <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14 }}>Add your first member</Text>
                  </Pressable>
                  <Pressable onPress={() => setFamilyOpen(true)} hitSlop={6}>
                    <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>Create or join another family</Text>
                  </Pressable>
                </View>
              </GlassSurface>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* bottom nav */}
      <BottomNav c={c} meId={meId} onHome={() => {}} onScan={() => router.push('/facematch')} onTree={() => router.push('/tree')} onAI={openChat}
        onMe={() => meId ? router.push({ pathname: '/profile', params: { id: meId } }) : router.push('/member')} />

      {/* settings */}
      <BottomSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} heightRatio={0.74}>
        <SettingsPanel onClose={() => setSettingsOpen(false)} onOpenCalendar={() => { setSettingsOpen(false); setCalendarOpen(true); }} />
      </BottomSheet>

      {/* family calendar */}
      <BottomSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} heightRatio={0.88}>
        <CalendarPanel members={members} relationships={relationships} events={events}
          treeName={treeMetadata?.name ?? activeFamily?.name} onClose={() => setCalendarOpen(false)} />
      </BottomSheet>

      {/* family switcher */}
      <BottomSheet visible={familyOpen} onClose={() => setFamilyOpen(false)} heightRatio={0.7}>
        <FamilyPickerPanel onClose={() => setFamilyOpen(false)} onOpenInfo={() => { setFamilyOpen(false); setFamilyInfoOpen(true); }} />
      </BottomSheet>

      {/* family info */}
      <BottomSheet visible={familyInfoOpen} onClose={() => setFamilyInfoOpen(false)} heightRatio={0.88}>
        {activeTreeId ? (
          <FamilyInfoPanel treeId={activeTreeId} family={activeFamily} members={members} relationships={relationships}
            onClose={() => setFamilyInfoOpen(false)}
            onSwitchFamily={() => { setFamilyInfoOpen(false); setFamilyOpen(true); }}
            onUploadPhoto={() => { setFamilyInfoOpen(false); router.push('/familyphoto'); }}
            onOpenEvents={() => { setFamilyInfoOpen(false); router.push('/events'); }}
            onOpenMasterEdit={() => { setFamilyInfoOpen(false); router.push('/masteredit'); }} />
        ) : null}
      </BottomSheet>

      {/* Web: floating glass chat sheet. Native uses the /chat route. */}
      <Modal visible={chatOpen} transparent animationType="fade" onRequestClose={() => setChatOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setChatOpen(false)} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <GlassSurface rounded={radius.xl} intensity={70} style={{ flex: 1, overflow: 'hidden', borderColor: c.line }}>
            <View style={{ flex: 1, backgroundColor: c.mode === 'dark' ? '#13131d' : '#fbf8f1' }}>
              <ChatPanel
                members={members}
                relationships={relationships}
                sessionKey={activeTreeId ?? 'default'}
                onOpenMember={(m: Member) => { setChatOpen(false); router.push({ pathname: '/profile', params: { id: m.id } }); }}
                onClose={() => setChatOpen(false)}
              />
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </View>
  );
}

// Floating icon tile in the hero (design's ft-float animation).
function FloatTile({ c }: { c: Palette }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
    }}>
      <Icon name="tree" size={40} stroke={1.5} color={c.accentInk} />
    </Animated.View>
  );
}

function BottomNav({ c, meId, onHome, onScan, onTree, onAI, onMe }: {
  c: Palette; meId?: string; onHome: () => void; onScan: () => void; onTree: () => void; onAI: () => void; onMe: () => void;
}) {
  const item = (ic: IconName, lb: string, fn: () => void, active = false) => (
    <Pressable key={lb} onPress={fn} style={{ alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 12, minWidth: 52 }}>
      <Icon name={ic} size={21} stroke={active ? 2 : 1.7} color={active ? c.accent : c.mute} />
      <Text style={{ fontSize: 10, fontFamily: font.sansSemi, color: active ? c.accent : c.mute }}>{lb}</Text>
    </Pressable>
  );
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: Platform.OS === 'web' ? 14 : 22 }} pointerEvents="box-none">
      <GlassSurface rounded={radius.xl} intensity={60} style={{ overflow: 'visible' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.glassBg }}>
          {item('home', 'Home', onHome, true)}
          {item('scan', 'Scan', onScan)}
          <Pressable onPress={onTree} style={({ pressed }) => ({
            width: 60, height: 60, borderRadius: 20, marginTop: -28,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 3, borderColor: c.bg, overflow: 'hidden',
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
            <LinearGradient colors={[c.accent, c.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="tree" size={27} color={c.accentInk} />
            </LinearGradient>
          </Pressable>
          {item('sparkles', 'AI', onAI)}
          {item('user', 'Me', onMe)}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { position: 'absolute', right: 16, bottom: 16, top: 80, width: 400, maxWidth: '94%', alignSelf: 'flex-end' },
});

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme, radius, space } from '../src/theme/theme';
import { GlassSurface } from '../src/theme/GlassSurface';
import { ChatPanel } from '../src/components/ChatPanel';
import type { Member } from '../src/shared/types';

export default function Home() {
  const { c, mode, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const { members, relationships, treeMetadata, loading } = useFamilyTree(user?.uid);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openChat = () => { if (Platform.OS === 'web') setChatOpen(true); else router.push('/chat'); };
  const go = (path: '/tree' | '/facematch' | '/export') => { setMenuOpen(false); router.push(path); };
  const shown = query.trim()
    ? members.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()))
    : members;

  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <GlassSurface style={{ marginBottom: 16 }} rounded={radius.xl}>
        <View style={{ padding: space(5), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.ink }]}>{treeMetadata?.name ?? 'My Family Tree'}</Text>
            <Text style={[styles.sub, { color: c.mute }]}>{user?.email}</Text>
          </View>
          <Pressable onPress={toggle} style={[styles.iconBtn, { backgroundColor: c.accentSoft, borderColor: c.accent, marginRight: 8 }]}>
            <Text style={{ fontSize: 16 }}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
          </Pressable>
          <Pressable onPress={() => setMenuOpen(true)} style={[styles.iconBtn, { backgroundColor: c.accent, borderColor: c.accent }]}>
            <Text style={{ fontSize: 20, color: '#fff' }}>☰</Text>
          </Pressable>
        </View>
      </GlassSurface>

      <GlassSurface style={{ marginBottom: 16 }}>
        <View style={{ padding: space(5), flexDirection: 'row', gap: 12 }}>
          <Stat label="Members" value={loading ? '…' : members.length} c={c} />
          <Stat label="Relationships" value={loading ? '…' : relationships.length} c={c} />
        </View>
      </GlassSurface>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search members…"
        placeholderTextColor={c.mute}
        style={[styles.search, { color: c.ink, borderColor: c.line, backgroundColor: c.paper }]}
      />

      <GlassSurface>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: space(4) }}>
          {shown.map((m) => (
            <Pressable key={m.id} onPress={() => router.push({ pathname: '/profile', params: { id: m.id } })} style={[styles.row, { borderColor: c.lineSoft }]}>
              <View style={[styles.avatar, { backgroundColor: m.gender === 'female' ? c.cardF : c.cardM }]}>
                <Text style={{ color: c.inkSoft, fontWeight: '700', fontSize: 12 }}>
                  {m.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: '600' }}>{m.name}</Text>
                <Text style={{ color: c.mute, fontSize: 12 }}>{m.birthDate ? `b. ${m.birthDate.slice(0, 4)}` : '—'}</Text>
              </View>
              <Text style={{ color: c.mute, fontSize: 18 }}>›</Text>
            </Pressable>
          ))}
          {!loading && shown.length === 0 && (
            <Text style={{ color: c.mute, textAlign: 'center', padding: 24 }}>
              {query.trim() ? 'No matches.' : 'No members yet. Tap + to add.'}
            </Text>
          )}
        </ScrollView>
      </GlassSurface>

      <Pressable onPress={signOut} style={[styles.signout, { borderColor: c.line }]}>
        <Text style={{ color: c.inkSoft, fontWeight: '600' }}>Sign out</Text>
      </Pressable>
    </ScrollView>

    <Pressable onPress={openChat} style={[styles.fab, styles.fabChat, { backgroundColor: c.paper, borderColor: c.line }]}>
      <Text style={{ fontSize: 22 }}>✨</Text>
    </Pressable>
    <Pressable onPress={() => router.push('/link')} style={[styles.fab, styles.fabSecondary, { backgroundColor: c.paper, borderColor: c.line }]}>
      <Text style={{ fontSize: 22 }}>🔗</Text>
    </Pressable>
    <Pressable onPress={() => router.push('/member')} style={[styles.fab, { backgroundColor: c.accent }]}>
      <Text style={{ color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 }}>+</Text>
    </Pressable>

    {/* Header menu */}
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setMenuOpen(false)} />
      <View style={styles.menuWrap} pointerEvents="box-none">
        <GlassSurface rounded={radius.lg} intensity={70} style={{ overflow: 'hidden', borderColor: c.line }}>
          <View style={{ backgroundColor: c.glassBg, paddingVertical: 6 }}>
            {([['🌳', 'Visualize', () => go('/tree')], ['🔍', 'Face match', () => go('/facematch')], ['⤓', 'Export & import', () => go('/export')]] as const).map(([icon, label, fn]) => (
              <Pressable key={label} onPress={fn} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: c.accentSoft }]}>
                <Text style={{ fontSize: 18, width: 28 }}>{icon}</Text>
                <Text style={{ color: c.ink, fontWeight: '600', fontSize: 15 }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </GlassSurface>
      </View>
    </Modal>

    {/* Web: floating glass chat sheet. Native uses the /chat route. */}
    <Modal visible={chatOpen} transparent animationType="fade" onRequestClose={() => setChatOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setChatOpen(false)} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <GlassSurface rounded={radius.xl} intensity={70} style={{ flex: 1, overflow: 'hidden', borderColor: c.line }}>
          <View style={{ flex: 1, backgroundColor: c.glassBg }}>
            <ChatPanel
              members={members}
              relationships={relationships}
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

function Stat({ label, value, c }: { label: string; value: number | string; c: ReturnType<typeof useTheme>['c'] }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.ink, fontSize: 28, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: c.mute, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  signout: { marginTop: 16, borderWidth: 1, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  search: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 12 },
  fab: {
    position: 'absolute', right: 20, bottom: 28, width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabSecondary: { right: 24, bottom: 98, width: 52, height: 52, borderRadius: 26, borderWidth: 1 },
  fabChat: { right: 24, bottom: 160, width: 52, height: 52, borderRadius: 26, borderWidth: 1 },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { position: 'absolute', right: 16, bottom: 16, top: 80, width: 400, maxWidth: '94%', alignSelf: 'flex-end' },
  menuWrap: { position: 'absolute', right: 16, top: 76, width: 230 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
});

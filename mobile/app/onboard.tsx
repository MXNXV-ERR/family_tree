// First-run onboarding. A brand-new account lands here (no auto-created tree) to
// either create a family they own or request to join one by invite code. Reuses
// createFamily / requestToJoinFamily; routes to /home once an active family
// exists (create, instant open-join, or an approved request via self-heal).
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { createFamily, requestToJoinFamily } from '../src/firebase/families';
import { useTheme, radius, space, font, type Palette } from '../src/theme/theme';
import { GlassSurface } from '../src/theme/GlassSurface';
import { Icon } from '../src/ui/Icon';

type Mode = 'choose' | 'create' | 'join' | 'pending';

export default function Onboard() {
  const { c } = useTheme();
  const { user, signOut } = useAuth();
  const { setActiveTreeId, needsOnboarding, loadingFamilies } = useFamily();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('choose');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pendingName, setPendingName] = useState('');

  // Once an active family exists (create / open-join / approved request), leave.
  useEffect(() => {
    if (user && !loadingFamilies && !needsOnboarding && mode !== 'pending') router.replace('/home');
  }, [user, needsOnboarding, loadingFamilies, mode]);

  if (!user) return <Redirect href="/login" />;

  const doCreate = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    try {
      const id = await createFamily(user.uid, user.email, { name: name.trim(), region: region.trim() });
      setActiveTreeId(id);
      router.replace('/home');
    } catch (e: any) {
      setErr(e?.message || 'Could not create the family. Check your connection.');
    } finally { setBusy(false); }
  };

  const doJoin = async () => {
    if (!code.trim()) return;
    setBusy(true); setErr('');
    try {
      const res = await requestToJoinFamily(user.uid, user.email, code.trim());
      if (!res) { setErr('No family found for that invite code.'); return; }
      if (res.status === 'joined') {
        setActiveTreeId(res.treeId);
        router.replace('/home');
      } else {
        setPendingName(code.trim().toUpperCase());
        setMode('pending');
      }
    } catch (e: any) {
      setErr(e?.message || 'Could not send the request. Check the code.');
    } finally { setBusy(false); }
  };

  const field = (value: string, set: (v: string) => void, placeholder: string, caps: 'characters' | 'sentences' = 'sentences') => (
    <TextInput
      value={value} onChangeText={set} placeholder={placeholder} placeholderTextColor={c.mute} autoCapitalize={caps}
      style={[styles.input, { color: c.ink, borderColor: c.line, backgroundColor: c.paper }, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null]}
    />
  );

  const primaryBtn = (label: string, onPress: () => void, disabled: boolean) => (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.btn, { backgroundColor: c.accent, opacity: pressed || disabled ? 0.7 : 1 }]}>
      {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={[styles.btnText, { color: c.accentInk }]}>{label}</Text>}
    </Pressable>
  );

  const backBtn = (
    <Pressable onPress={() => { setErr(''); setMode('choose'); }} style={({ pressed }) => [styles.btnOutline, { borderColor: c.line, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi }}>Back</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: 'transparent' }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <GlassSurface style={styles.card} rounded={radius.xl}>
          <View style={{ padding: space(7), gap: space(3) }}>
            <View style={{ alignItems: 'center', marginBottom: space(2) }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: space(3) }}>
                <Icon name="branch" size={26} color={c.accent} />
              </View>
              <Text style={[styles.title, { color: c.ink, fontFamily: font.serifItalic }]}>
                {mode === 'pending' ? 'Request sent' : 'Welcome'}
              </Text>
              <Text style={[styles.sub, { color: c.mute, fontFamily: font.mono }]}>
                {mode === 'create' ? 'NAME YOUR FAMILY' : mode === 'join' ? 'ENTER INVITE CODE' : mode === 'pending' ? 'WAITING FOR APPROVAL' : 'CREATE OR JOIN A FAMILY'}
              </Text>
            </View>

            {mode === 'choose' && (
              <>
                <Pressable onPress={() => { setErr(''); setMode('create'); }} style={({ pressed }) => [styles.choice, { borderColor: c.line, backgroundColor: c.paper, opacity: pressed ? 0.85 : 1 }]}>
                  <Icon name="plus" size={22} color={c.accent} stroke={2.1} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontFamily: font.sansBold, fontSize: 16 }}>Create a family</Text>
                    <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13, marginTop: 2 }}>Start a new tree you own.</Text>
                  </View>
                  <Icon name="chevR" size={18} color={c.faint} />
                </Pressable>
                <Pressable onPress={() => { setErr(''); setMode('join'); }} style={({ pressed }) => [styles.choice, { borderColor: c.line, backgroundColor: c.paper, opacity: pressed ? 0.85 : 1 }]}>
                  <Icon name="link" size={22} color={c.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontFamily: font.sansBold, fontSize: 16 }}>Join a family</Text>
                    <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13, marginTop: 2 }}>Use an invite code (approval may be required).</Text>
                  </View>
                  <Icon name="chevR" size={18} color={c.faint} />
                </Pressable>
              </>
            )}

            {mode === 'create' && (
              <>
                {field(name, setName, 'Family name (e.g. Kapoor Family)')}
                {field(region, setRegion, 'Region (optional)')}
                {err ? <Text style={{ color: c.danger, fontFamily: font.sans }}>{err}</Text> : null}
                {primaryBtn('Create family', doCreate, busy || !name.trim())}
                {backBtn}
              </>
            )}

            {mode === 'join' && (
              <>
                {field(code, setCode, 'Invite code (e.g. MEHTA-7K2X)', 'characters')}
                {err ? <Text style={{ color: c.danger, fontFamily: font.sans }}>{err}</Text> : null}
                {primaryBtn('Request to join', doJoin, busy || !code.trim())}
                {backBtn}
              </>
            )}

            {mode === 'pending' && (
              <>
                <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 14.5, lineHeight: 21, textAlign: 'center' }}>
                  Your request to join <Text style={{ fontFamily: font.sansBold }}>{pendingName}</Text> was sent. You'll get access as soon as an owner or admin approves it.
                </Text>
                <Pressable onPress={() => { setCode(''); setErr(''); setMode('choose'); }} style={({ pressed }) => [styles.btnOutline, { borderColor: c.line, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi }}>Create or join another</Text>
                </Pressable>
              </>
            )}

            <Pressable onPress={() => signOut()} style={{ alignItems: 'center', marginTop: space(2) }}>
              <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13 }}>Sign out</Text>
            </Pressable>
          </View>
        </GlassSurface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { width: '100%', maxWidth: 440 },
  title: { fontSize: 32, textAlign: 'center' },
  sub: { fontSize: 11, textAlign: 'center', marginTop: 4, letterSpacing: 1.5 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 15 },
  btn: { borderRadius: radius.md, padding: 15, alignItems: 'center' },
  btnText: { fontWeight: '700', fontSize: 15, fontFamily: font.sansBold },
  btnOutline: { borderWidth: 1, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 1, borderRadius: radius.lg },
});

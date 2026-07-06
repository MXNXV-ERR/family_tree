// Invite-link landing route: /join?code=MEHTA-1A2B (web URL or the
// familytree:// deep link). Signed-in users confirm and join (instant on
// open-policy families, request-on-approval otherwise). Signed-out users get
// sent to sign in; the code is stashed and the index gate routes them back.
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { requestToJoinFamily } from '../src/firebase/families';
import { kvGet, kvSet } from '../src/firebase/kvStore';
import { PENDING_JOIN_CODE_KEY } from '../src/shared/invite';
import { useTheme, radius, font } from '../src/theme/theme';
import { GlassSurface } from '../src/theme/GlassSurface';
import { Icon } from '../src/ui/Icon';

export default function JoinScreen() {
  const { c } = useTheme();
  const { user, loading } = useAuth();
  const { setActiveTreeId } = useFamily();
  const router = useRouter();
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState(typeof codeParam === 'string' ? codeParam : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  // Arriving without a ?code (e.g. routed back after sign-in) → use the stash.
  useEffect(() => {
    if (code) return;
    kvGet(PENDING_JOIN_CODE_KEY).then((saved) => { if (saved) setCode(saved); });
  }, []);

  const signInFirst = async () => {
    if (code.trim()) await kvSet(PENDING_JOIN_CODE_KEY, code.trim().toUpperCase());
    router.replace('/login');
  };

  const doJoin = async () => {
    if (!user || !code.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await requestToJoinFamily(user.uid, user.email, code.trim());
      if (!res) { setErr('No family found for that invite code.'); return; }
      await kvSet(PENDING_JOIN_CODE_KEY, ''); // consumed
      if (res.status === 'joined') {
        setActiveTreeId(res.treeId);
        router.replace('/home');
      } else {
        setRequested(true);
      }
    } catch {
      setErr('Could not join. Check the code and your connection.');
    } finally { setBusy(false); }
  };

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <GlassSurface rounded={radius.xl} style={{ width: '100%', maxWidth: 440 }}>
        <View style={{ padding: 28, alignItems: 'center', gap: 14 }}>
          <View style={{ width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft }}>
            <Icon name="link" size={28} color={c.accent} />
          </View>
          <Text style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 26, textAlign: 'center' }}>Join a family</Text>

          {requested ? (
            <>
              <Text style={{ color: c.mute, fontFamily: font.sansMed, fontSize: 14.5, lineHeight: 21, textAlign: 'center' }}>
                Request sent — an owner or admin needs to approve it. The family appears in your switcher once you're in.
              </Text>
              <Pressable onPress={() => router.replace('/home')} style={({ pressed }) => ({ height: 48, paddingHorizontal: 24, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14.5 }}>Back to your tree</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ color: c.mute, fontFamily: font.sansMed, fontSize: 14.5, lineHeight: 21, textAlign: 'center' }}>
                {user ? 'You were invited with this code. Join to see and grow the tree together.'
                  : 'Sign in (or create an account) first — then you join with this code.'}
              </Text>
              <TextInput
                value={code} onChangeText={setCode} placeholder="INVITE-CODE" placeholderTextColor={c.mute} autoCapitalize="characters"
                style={{ alignSelf: 'stretch', height: 50, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.accent, fontFamily: font.monoSemi, fontSize: 16, textAlign: 'center', letterSpacing: 1.5, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
              {err ? <Text style={{ color: c.rose, fontFamily: font.sansMed, fontSize: 13, textAlign: 'center' }}>{err}</Text> : null}
              {user ? (
                <Pressable disabled={busy || !code.trim()} onPress={doJoin} style={({ pressed }) => ({ alignSelf: 'stretch', height: 50, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || !code.trim() ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                  {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Join this family</Text>}
                </Pressable>
              ) : (
                <Pressable onPress={signInFirst} style={({ pressed }) => ({ alignSelf: 'stretch', height: 50, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                  <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Sign in to join</Text>
                </Pressable>
              )}
              {user ? (
                <Pressable onPress={() => router.replace('/home')} hitSlop={6}>
                  <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 13 }}>Not now</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </GlassSurface>
    </View>
  );
}

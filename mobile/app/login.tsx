import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../src/firebase/AuthContext';
import { useTheme, radius, space, font, type Palette } from '../src/theme/theme';
import { GlassSurface } from '../src/theme/GlassSurface';
import { Icon } from '../src/ui/Icon';
import { Rise } from '../src/ui/primitives';
import { useResponsive } from '../src/ui/useResponsive';

WebBrowser.maybeCompleteAuthSession();

// OAuth client IDs from Google Cloud console. Supply via env (any missing
// platform just disables the Google button on that platform).
const GOOGLE = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

export default function Login() {
  const { c } = useTheme();
  const { isDesktop } = useResponsive();
  const { signIn, signInWithGoogleIdToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const googleConfigured = !!(GOOGLE.webClientId || GOOGLE.androidClientId || GOOGLE.iosClientId);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/home');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.replace('Firebase: ', '') : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const card = (
      <GlassSurface style={styles.card} rounded={radius.xl}>
        <View style={{ padding: space(7) }}>
          <Text style={[styles.title, { color: c.ink, fontFamily: font.serifItalic }]}>{isDesktop ? 'Sign in' : 'Family Tree'}</Text>
          <Text style={[styles.sub, { color: c.mute, fontFamily: font.mono, letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 11 }]}>Welcome back</Text>

          <TextInput
            placeholder="Email"
            placeholderTextColor={c.mute}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { color: c.ink, borderColor: c.line, backgroundColor: c.paper }]}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={c.mute}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { color: c.ink, borderColor: c.line, backgroundColor: c.paper }]}
          />

          {error ? <Text style={{ color: c.danger, marginBottom: space(2) }}>{error}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={loading}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: c.accent, opacity: pressed || loading ? 0.85 : 1 },
            ]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
          </Pressable>

          {/* Google sign-in via expo-auth-session. Enabled once OAuth client IDs
              are present in env (EXPO_PUBLIC_GOOGLE_*_CLIENT_ID). */}
          {googleConfigured ? (
            <GoogleButton
              onToken={(t) => {
                setLoading(true);
                signInWithGoogleIdToken(t)
                  .then(() => router.replace('/home'))
                  .catch((e) => setError(e instanceof Error ? e.message.replace('Firebase: ', '') : 'Google sign-in failed'))
                  .finally(() => setLoading(false));
              }}
              loading={loading}
              c={c}
            />
          ) : (
            <Pressable disabled style={[styles.btnOutline, { borderColor: c.line, opacity: 0.5 }]}>
              <Text style={{ color: c.inkSoft, fontWeight: '600' }}>Google (add OAuth client IDs)</Text>
            </Pressable>
          )}
        </View>
      </GlassSurface>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
        <LoginHero c={c} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 }}>{card}</View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: c.bg }]}
    >
      <AmbientGlow c={c} />
      <Rise i={0} style={{ width: '100%', alignItems: 'center' }}>{card}</Rise>
    </KeyboardAvoidingView>
  );
}

// Soft floating radial glow behind the login card (design's ambient tree glyph).
function AmbientGlow({ c }: { c: Palette }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 3500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 3500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: '12%', width: 320, height: 320, borderRadius: 320,
      backgroundColor: c.accentSoft, opacity: 0.6,
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) }],
    }} />
  );
}

// Desktop-only branded hero panel (left). Generic app branding — no single
// family name, since a user can belong to several families.
function LoginHero({ c }: { c: Palette }) {
  return (
    <LinearGradient colors={[c.accent, c.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 56, justifyContent: 'space-between', maxWidth: 560 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="branch" size={26} color={c.accentInk} />
        </View>
        <Text style={{ color: c.accentInk, fontFamily: font.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 }}>Family Tree</Text>
      </View>

      <View>
        <Text style={{ color: c.accentInk, fontFamily: font.serifItalic, fontSize: 52, lineHeight: 56 }}>Every name{'\n'}has a story.</Text>
        <Text style={{ color: c.accentInk, opacity: 0.86, fontFamily: font.sans, fontSize: 17, lineHeight: 26, marginTop: 18, maxWidth: 420 }}>
          Map every branch of your family, switch between the trees you belong to, and keep their stories in one place.
        </Text>
      </View>

      {/* simple node motif */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)' }} />
            {i < 2 ? <View style={{ width: 26, height: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} /> : null}
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

// Only mounted when at least one OAuth client ID is configured, so the hook
// (which throws on a missing client id) never runs in the unconfigured case.
function GoogleButton({ onToken, loading, c }: { onToken: (idToken: string) => void; loading: boolean; c: ReturnType<typeof useTheme>['c'] }) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(GOOGLE);
  useEffect(() => {
    if (response?.type === 'success' && response.params?.id_token) onToken(response.params.id_token);
  }, [response]);
  return (
    <Pressable disabled={!request || loading} onPress={() => promptAsync()} style={[styles.btnOutline, { borderColor: c.line }]}>
      <Text style={{ color: c.inkSoft, fontWeight: '600' }}>Continue with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420 },
  title: { fontSize: 34, textAlign: 'center' },
  sub: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 15, marginBottom: 12 },
  btn: { borderRadius: radius.md, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnOutline: { borderWidth: 1, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: 12 },
});

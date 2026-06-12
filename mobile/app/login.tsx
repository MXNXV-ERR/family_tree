import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../src/firebase/AuthContext';
import { useTheme, radius, space } from '../src/theme/theme';
import { GlassSurface } from '../src/theme/GlassSurface';

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: c.bg }]}
    >
      <GlassSurface style={styles.card} rounded={radius.xl}>
        <View style={{ padding: space(7) }}>
          <Text style={[styles.title, { color: c.ink }]}>Family Tree</Text>
          <Text style={[styles.sub, { color: c.mute }]}>Welcome back</Text>

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
    </KeyboardAvoidingView>
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
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 15, marginBottom: 12 },
  btn: { borderRadius: radius.md, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnOutline: { borderWidth: 1, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: 12 },
});

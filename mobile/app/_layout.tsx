import { useEffect } from 'react';
import { LogBox, View, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, ThemeProvider as NavThemeProvider, DarkTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { SettingsProvider } from '../src/theme/SettingsContext';
import { AuthProvider, useAuth } from '../src/firebase/AuthContext';
import { FamilyProvider } from '../src/firebase/FamilyContext';
import { UserProfileProvider } from '../src/firebase/UserProfileContext';
import { RelTermsProvider } from '../src/theme/RelTermsContext';
import { useTheme } from '../src/theme/theme';
import { useAppFonts } from '../src/theme/fonts';
import { AmbientBackground } from '../src/ui/AmbientBackground';
import { AmbientMotionProvider } from '../src/ui/AmbientMotion';

// react-native-svg spreads RN responder props onto the web <svg> element, which
// React warns about. Harmless and web-only — silence it so it doesn't spam dev.
LogBox.ignoreLogs(['Unknown event handler property']);

// expo-router themes its navigation scene container from the system colour scheme;
// the light DefaultTheme paints an opaque rgb(242,242,242) that would cover the
// AmbientBackground. A transparent nav theme lets the fixed sky show through every
// screen (this is what makes the persistent background actually visible on web).
const navTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent', card: 'transparent' } };

// Hold the native splash on screen until the fonts are ready, so there's no
// flash of unstyled / fallback text on cold start.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080611', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#a78bff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SettingsProvider>
            <AuthProvider>
              <FamilyProvider>
                <UserProfileProvider>
                  <RelTermsProvider>
                    <NavShell />
                  </RelTermsProvider>
                </UserProfileProvider>
              </FamilyProvider>
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Keeps app content inside the device safe area (Android draws edge-to-edge by
// default in RN 0.85, so without this content slides under the notch/camera).
// Themed so the inset strips match the background in light + dark.
function NavShell() {
  const { c, mode } = useTheme();
  // Hold routing until Firebase has restored the session. Without this gate, a
  // hard refresh renders a screen with user=null (loading) and the screen's
  // "if (!user) go to /login" logic fires before auth resolves — logging the
  // user out on every refresh.
  const { loading } = useAuth();
  return (
    // Root paints the themed bg edge-to-edge; AmbientBackground draws the fixed
    // aurora + stars behind everything; the SafeAreaView + Stack are transparent
    // so screens fade/slide OVER the constant sky (no black flash on navigation).
    // minHeight:100vh (web) guarantees the base fills the viewport even on short
    // screens (login/loading) now that screens no longer paint their own bg.
    <AmbientMotionProvider>
      <View style={[{ flex: 1, backgroundColor: c.bg }, Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : null]}>
        <AmbientBackground />
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: 'transparent' }}>
          <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <NavThemeProvider value={navTheme}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                  animation: 'fade',
                }}
              />
            </NavThemeProvider>
          )}
        </SafeAreaView>
      </View>
    </AmbientMotionProvider>
  );
}

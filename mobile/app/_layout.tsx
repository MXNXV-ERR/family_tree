import { LogBox, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { SettingsProvider } from '../src/theme/SettingsContext';
import { AuthProvider } from '../src/firebase/AuthContext';
import { FamilyProvider } from '../src/firebase/FamilyContext';
import { useTheme } from '../src/theme/theme';
import { useAppFonts } from '../src/theme/fonts';

// react-native-svg spreads RN responder props onto the web <svg> element, which
// React warns about. Harmless and web-only — silence it so it doesn't spam dev.
LogBox.ignoreLogs(['Unknown event handler property']);

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0c0c12', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#8f8bff" />
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
                <NavShell />
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
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'fade',
        }}
      />
    </SafeAreaView>
  );
}

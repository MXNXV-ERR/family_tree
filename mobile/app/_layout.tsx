import { LogBox, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { SettingsProvider } from '../src/theme/SettingsContext';
import { AuthProvider } from '../src/firebase/AuthContext';
import { FamilyProvider } from '../src/firebase/FamilyContext';
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
      <ThemeProvider>
        <SettingsProvider>
          <AuthProvider>
            <FamilyProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#0c0c12' },
                  animation: 'fade',
                }}
              />
            </FamilyProvider>
          </AuthProvider>
        </SettingsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

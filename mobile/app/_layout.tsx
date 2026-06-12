import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthProvider } from '../src/firebase/AuthContext';

// react-native-svg spreads RN responder props onto the web <svg> element, which
// React warns about. Harmless and web-only — silence it so it doesn't spam dev.
LogBox.ignoreLogs(['Unknown event handler property']);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0d0d14' },
              animation: 'fade',
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

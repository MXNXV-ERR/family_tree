// Theme provider — defaults to DARK, persists mode + accent to AsyncStorage. A
// short crossfade on theme change masks the instant colour swap. Accent is a
// theme concern (it recolours the whole palette), so it lives here; the ambient
// star/glow prefs live in SettingsContext.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext, makePalette, type ThemeMode, type AccentKey } from './theme';

const KEY = 'ft.themeMode';
const ACCENT_KEY = 'ft.accent';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark'); // dark default
  const [accent, setAccentState] = useState<AccentKey>('violet');
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark') setModeState(v);
    });
    AsyncStorage.getItem(ACCENT_KEY).then((v) => {
      if (v === 'violet' || v === 'teal' || v === 'gold') setAccentState(v);
    });
  }, []);

  const crossfade = () => {
    fade.setValue(0.55);
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };

  const setMode = (m: ThemeMode) => {
    if (m === mode) return;
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
    crossfade();
  };
  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const setAccent = (a: AccentKey) => {
    if (a === accent) return;
    setAccentState(a);
    AsyncStorage.setItem(ACCENT_KEY, a).catch(() => {});
    crossfade();
  };

  const c = makePalette(mode, accent);

  return (
    <ThemeContext.Provider value={{ c, mode, setMode, toggle, accent, setAccent }}>
      <Animated.View style={{ flex: 1, opacity: fade }}>{children}</Animated.View>
    </ThemeContext.Provider>
  );
}

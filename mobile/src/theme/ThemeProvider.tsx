// Theme provider — defaults to DARK, persists choice to AsyncStorage. A short
// crossfade on theme change masks the instant colour swap.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext, dark, light, type ThemeMode } from './theme';

const KEY = 'ft.themeMode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark'); // dark default
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark') setModeState(v);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    if (m === mode) return;
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
    fade.setValue(0.55);
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };
  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const c = mode === 'dark' ? dark : light;

  return (
    <ThemeContext.Provider value={{ c, mode, setMode, toggle }}>
      <Animated.View style={{ flex: 1, opacity: fade }}>{children}</Animated.View>
    </ThemeContext.Provider>
  );
}

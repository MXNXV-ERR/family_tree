// Appearance/display preferences (the design's Settings sheet → "Display").
// Persisted to AsyncStorage. Read by GlassSurface (glass), Rise/Counter (motion),
// the year-label spots (years), and a global text-size scale (textSize, applied
// as a page zoom on web). Defaults: everything on, medium text.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export const TEXT_SCALE: Record<TextSize, number> = { sm: 0.9, md: 1, lg: 1.15, xl: 1.3 };

export interface Settings {
  years: boolean;      // show birth/death year labels
  glass: boolean;      // translucent glass surfaces vs. solid
  motion: boolean;     // entrance/count-up animations
  reminders: boolean;  // birthday/anniversary local notifications (native)
  firstNames: boolean; // visualizations label nodes "Ravi" (dupes get "Ravi K.")
  textSize: TextSize;  // global text/UI scale
  stars: number;       // ambient constellation density (0–320, dark mode only)
  glow: number;        // ambient aurora intensity (0–100%)
  aurora: string;      // aurora colour preset key (theme.AURORA_PRESETS)
  revealSpeed: number; // node/generation entrance speed multiplier (0.5–2.5×)
}

export interface SettingsCtx extends Settings {
  setOption: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
}

const DEFAULTS: Settings = { years: true, glass: true, motion: true, reminders: false, firstNames: true, textSize: 'md', stars: 140, glow: 80, aurora: 'violet', revealSpeed: 1 };
const KEY = 'ft.settings';

const Ctx = createContext<SettingsCtx>({ ...DEFAULTS, setOption: () => {} });

export const useSettings = () => useContext(Ctx);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (!v) return;
      try { setS({ ...DEFAULTS, ...JSON.parse(v) }); } catch {}
    });
  }, []);

  // Apply the text scale as a page zoom on web. (CSS `zoom` magnifies content
  // but leaves window.innerWidth intact, so the desktop breakpoint is unaffected.)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    (document.documentElement.style as any).zoom = String(TEXT_SCALE[s.textSize]);
  }, [s.textSize]);

  const setOption = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS((prev) => {
      const next = { ...prev, [k]: v };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return <Ctx.Provider value={{ ...s, setOption }}>{children}</Ctx.Provider>;
}

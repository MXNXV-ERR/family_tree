// Design tokens. Dark is the DEFAULT (requirement #1). Palette ported from the
// web app's `--fe-*` variables so the visual language carries over.
import { createContext, useContext } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface Palette {
  mode: ThemeMode;
  bg: string;
  paper: string;        // solid card background
  glassTint: 'dark' | 'light'; // BlurView tint
  glassBg: string;      // translucent fallback / overlay color
  ink: string;
  inkSoft: string;
  mute: string;
  line: string;
  lineSoft: string;
  accent: string;
  accentSoft: string;
  rose: string;
  roseSoft: string;
  cardM: string;        // male card bg
  cardMBorder: string;
  cardF: string;        // female card bg
  cardFBorder: string;
  relParent: string;
  relChild: string;
  relPartner: string;
  relEx: string;
  relSibling: string;
  relOther: string;
  danger: string;
  success: string;
}

export const dark: Palette = {
  mode: 'dark',
  bg: '#0d0d14',
  paper: '#15151f',
  glassTint: 'dark',
  glassBg: 'rgba(30,30,46,0.55)',
  ink: '#ece6d6',
  inkSoft: '#c4bda9',
  mute: '#847d6c',
  line: '#2a2a36',
  lineSoft: '#1d1d28',
  accent: '#8b8bff',
  accentSoft: '#1f1f3a',
  rose: '#ff8caf',
  roseSoft: '#3a1a26',
  cardM: '#1a1f2e',
  cardMBorder: '#2a3554',
  cardF: '#28181d',
  cardFBorder: '#4a2730',
  relParent: '#a99bf5',
  relChild: '#5fd0b0',
  relPartner: '#ff9bb0',
  relEx: '#d8a37e',
  relSibling: '#d39bf0',
  relOther: '#9b9bb0',
  danger: '#ff6b6b',
  success: '#5fd0b0',
};

export const light: Palette = {
  mode: 'light',
  bg: '#f8fafc',
  paper: '#ffffff',
  glassTint: 'light',
  glassBg: 'rgba(255,255,255,0.6)',
  ink: '#111827',
  inkSoft: '#374151',
  mute: '#6b7280',
  line: '#e5e7eb',
  lineSoft: '#f3f4f6',
  accent: '#3a3aef',
  accentSoft: '#e6e6ff',
  rose: '#c92354',
  roseSoft: '#ffe2eb',
  cardM: '#eff6ff',
  cardMBorder: '#bfdbfe',
  cardF: '#fdf2f8',
  cardFBorder: '#fbcfe8',
  relParent: '#5b4fc4',
  relChild: '#1f9d7e',
  relPartner: '#d6557a',
  relEx: '#b5793f',
  relSibling: '#9a4fc4',
  relOther: '#6b7280',
  danger: '#dc2626',
  success: '#16a34a',
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const space = (n: number) => n * 4;

export interface ThemeCtx {
  c: Palette;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeCtx>({
  c: dark,
  mode: 'dark',
  setMode: () => {},
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);

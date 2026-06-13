// Design tokens — ported from the "family tree reimagined" design bundle.
// Dark is the DEFAULT; light is a warm paper tone, not a cold white.
// Type system: Newsreader (italic serif display) · Plus Jakarta Sans (body) ·
// Spline Sans Mono (meta labels). Families loaded in src/theme/fonts.ts.
import { createContext, useContext } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface Palette {
  mode: ThemeMode;
  bg: string;
  bg2: string;
  paper: string;        // solid card background
  paper2: string;
  glassTint: 'dark' | 'light'; // BlurView tint
  glassBg: string;      // translucent fallback / overlay color
  glassBrd: string;
  ink: string;
  inkSoft: string;
  mute: string;
  faint: string;
  line: string;
  lineSoft: string;
  accent: string;
  accent2: string;
  accentInk: string;
  accentSoft: string;
  rose: string;
  roseSoft: string;
  teal: string;
  amber: string;
  cardM: string;        // male card bg
  cardMBorder: string;
  cardF: string;        // female card bg
  cardFBorder: string;
  cardO: string;        // other/unknown card bg
  cardOBorder: string;
  relParent: string;
  relChild: string;
  relPartner: string;
  relEx: string;
  relSibling: string;
  relOther: string;
  danger: string;
  success: string;
  scrim: string;        // modal/drawer backdrop
}

export const dark: Palette = {
  mode: 'dark',
  bg: '#0c0c12',
  bg2: '#101019',
  paper: '#16161f',
  paper2: '#1c1c27',
  glassTint: 'dark',
  glassBg: 'rgba(28,28,42,0.55)',
  glassBrd: 'rgba(255,255,255,0.07)',
  ink: '#ece6d6',
  inkSoft: '#c2bba7',
  mute: '#847d6c',
  faint: '#5a5446',
  line: '#2a2a36',
  lineSoft: '#1e1e29',
  accent: '#8f8bff',
  accent2: '#b1a6ff',
  accentInk: '#ffffff',
  accentSoft: 'rgba(143,139,255,0.15)',
  rose: '#ff8caf',
  roseSoft: 'rgba(255,140,175,0.14)',
  teal: '#5fd0b0',
  amber: '#e0b873',
  cardM: '#181d2b',
  cardMBorder: '#2c3858',
  cardF: '#271820',
  cardFBorder: '#4d2733',
  cardO: '#1d1d28',
  cardOBorder: '#34343f',
  relParent: '#8f8bff',
  relChild: '#5fd0b0',
  relPartner: '#ff8caf',
  relEx: '#e0b873',
  relSibling: '#6fb1ff',
  relOther: '#847d6c',
  danger: '#ff6b6b',
  success: '#5fd0b0',
  scrim: 'rgba(0,0,0,0.55)',
};

export const light: Palette = {
  mode: 'light',
  bg: '#f4f1ea',
  bg2: '#ece8de',
  paper: '#fffdf8',
  paper2: '#f8f5ec',
  glassTint: 'light',
  glassBg: 'rgba(255,253,248,0.7)',
  glassBrd: 'rgba(40,34,24,0.08)',
  ink: '#2b2620',
  inkSoft: '#564e42',
  mute: '#8c8475',
  faint: '#b3aa98',
  line: '#e3ddcf',
  lineSoft: '#ece7da',
  accent: '#5a4ce0',
  accent2: '#6f5cf0',
  accentInk: '#ffffff',
  accentSoft: 'rgba(90,76,224,0.11)',
  rose: '#c8456f',
  roseSoft: 'rgba(200,69,111,0.10)',
  teal: '#1f9d7e',
  amber: '#b5793f',
  cardM: '#eef3fe',
  cardMBorder: '#cdddf9',
  cardF: '#fdeef3',
  cardFBorder: '#f6cdda',
  cardO: '#f3f0e8',
  cardOBorder: '#e2dcce',
  relParent: '#5a4ce0',
  relChild: '#1f9d7e',
  relPartner: '#c8456f',
  relEx: '#b5793f',
  relSibling: '#3f72c8',
  relOther: '#8c8475',
  danger: '#dc2626',
  success: '#1f9d7e',
  scrim: 'rgba(40,34,24,0.4)',
};

export const radius = { sm: 8, md: 13, lg: 16, xl: 24, pill: 999 };
export const space = (n: number) => n * 4;

// Font family map (loaded via expo-google-fonts in fonts.ts). RN custom fonts
// need an exact family per weight — never rely on fontWeight synthesis.
export const font = {
  serif: 'Newsreader_600SemiBold',
  serifItalic: 'Newsreader_600SemiBold_Italic',
  serifMedItalic: 'Newsreader_500Medium_Italic',
  sans: 'PlusJakartaSans_400Regular',
  sansMed: 'PlusJakartaSans_500Medium',
  sansSemi: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  sansHeavy: 'PlusJakartaSans_800ExtraBold',
  mono: 'SplineSansMono_400Regular',
  monoMed: 'SplineSansMono_500Medium',
  monoSemi: 'SplineSansMono_600SemiBold',
};

// Gendered card tint helper (matches design's genderTint()).
export const genderTint = (c: Palette, g?: string) =>
  g === 'female'
    ? { bg: c.cardF, brd: c.cardFBorder, ink: c.rose }
    : g === 'other'
    ? { bg: c.cardO, brd: c.cardOBorder, ink: c.mute }
    : { bg: c.cardM, brd: c.cardMBorder, ink: c.accent };

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

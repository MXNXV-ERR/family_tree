// Design tokens — "Aurora × Constellation" (Family Tree Prototype design bundle).
// Dark is the DEFAULT; light is a warm paper tone. Deep violet-black canvas, a
// user-selectable accent (violet / teal / gold), gold for stars + marriage edges.
// Type system: Spectral (UPRIGHT serif display — no italics) · Hanken Grotesk
// (body) · Spline Sans Mono (meta labels). Families loaded in src/theme/fonts.ts.
import { createContext, useContext } from 'react';

export type ThemeMode = 'dark' | 'light';
export type AccentKey = 'violet' | 'teal' | 'gold';

export interface Palette {
  mode: ThemeMode;
  bg: string;
  bg2: string;
  paper: string;        // solid card background (also glass-off fallback)
  paper2: string;
  glassTint: 'dark' | 'light'; // BlurView tint
  glassBg: string;      // translucent glass surface / overlay color
  glassBrd: string;
  ink: string;
  inkSoft: string;
  mute: string;
  faint: string;
  line: string;
  lineSoft: string;
  accent: string;       // resolved from the active AccentKey
  accent2: string;
  accentInk: string;
  accentSoft: string;
  gold: string;         // stars, marriage edges, highlights
  gold2: string;
  goldInk: string;
  rose: string;
  roseSoft: string;
  teal: string;
  amber: string;
  cardM: string;        // male card bg
  cardMBorder: string;
  cardMInk: string;     // male initials / accent ink
  cardF: string;        // female card bg
  cardFBorder: string;
  cardFInk: string;
  cardO: string;        // other/unknown card bg
  cardOBorder: string;
  cardOInk: string;
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

// --- accent sets (resolved into the palette by makePalette) ---------------
interface AccentSet { accent: string; accent2: string; accentInk: string; accentSoft: string }
const ACCENTS: Record<AccentKey, { dark: AccentSet; light: AccentSet }> = {
  violet: {
    dark:  { accent: '#a78bff', accent2: '#cf6bd0', accentInk: '#0a0713', accentSoft: 'rgba(167,139,255,0.16)' },
    light: { accent: '#6d4ee0', accent2: '#8b5cf0', accentInk: '#ffffff', accentSoft: 'rgba(109,78,224,0.12)' },
  },
  teal: {
    dark:  { accent: '#3fd6c0', accent2: '#5fe0cf', accentInk: '#04120f', accentSoft: 'rgba(63,214,192,0.16)' },
    light: { accent: '#1f9d7e', accent2: '#27b891', accentInk: '#ffffff', accentSoft: 'rgba(31,157,126,0.12)' },
  },
  gold: {
    dark:  { accent: '#ffce6b', accent2: '#f2a94c', accentInk: '#2a1a05', accentSoft: 'rgba(255,206,107,0.16)' },
    light: { accent: '#c98a24', accent2: '#b0741c', accentInk: '#ffffff', accentSoft: 'rgba(201,138,36,0.14)' },
  },
};

// Base palettes (accent fields carry the violet default; makePalette overrides).
const darkBase: Palette = {
  mode: 'dark',
  bg: '#080611',
  bg2: '#0d0a1a',
  paper: '#191325',
  paper2: '#221a34',
  glassTint: 'dark',
  glassBg: 'rgba(30,24,48,0.55)',
  glassBrd: 'rgba(190,170,255,0.16)',
  ink: '#f4efff',
  inkSoft: '#c9c1de',
  mute: '#938aad',
  faint: '#635a80',
  line: 'rgba(190,170,255,0.14)',
  lineSoft: 'rgba(190,170,255,0.07)',
  accent: '#a78bff',
  accent2: '#cf6bd0',
  accentInk: '#0a0713',
  accentSoft: 'rgba(167,139,255,0.16)',
  gold: '#ffce6b',
  gold2: '#f2a94c',
  goldInk: '#2a1a05',
  rose: '#ff7fae',
  roseSoft: 'rgba(255,127,174,0.14)',
  teal: '#3fd6c0',
  amber: '#e0b873',
  cardM: '#141a2e',
  cardMBorder: '#2a3a63',
  cardMInk: '#a9b8ff',
  cardF: '#241528',
  cardFBorder: '#54294a',
  cardFInk: '#ff7fae',
  cardO: '#1c1a2b',
  cardOBorder: '#3a3550',
  cardOInk: '#938aad',
  relParent: '#a78bff',
  relChild: '#3fd6c0',
  relPartner: '#ff7fae',
  relEx: '#e0b873',
  relSibling: '#6fb1ff',
  relOther: '#938aad',
  danger: '#ff6b6b',
  success: '#3fd6c0',
  scrim: 'rgba(5,3,12,0.6)',
};

const lightBase: Palette = {
  mode: 'light',
  bg: '#f4f1ea',
  bg2: '#ece7db',
  paper: '#fffdf8',
  paper2: '#f7f3ea',
  glassTint: 'light',
  glassBg: 'rgba(255,253,248,0.7)',
  glassBrd: 'rgba(60,40,90,0.12)',
  ink: '#241f2e',
  inkSoft: '#4d4560',
  mute: '#867d95',
  faint: '#a99fbb',
  line: 'rgba(60,40,90,0.14)',
  lineSoft: 'rgba(60,40,90,0.07)',
  accent: '#6d4ee0',
  accent2: '#8b5cf0',
  accentInk: '#ffffff',
  accentSoft: 'rgba(109,78,224,0.12)',
  gold: '#c98a24',
  gold2: '#b0741c',
  goldInk: '#ffffff',
  rose: '#c8456f',
  roseSoft: 'rgba(200,69,111,0.10)',
  teal: '#1f9d7e',
  amber: '#a9772f',
  cardM: '#eef2fe',
  cardMBorder: '#c8d6f5',
  cardMInk: '#4a5ec8',
  cardF: '#fceef4',
  cardFBorder: '#f2cbdd',
  cardFInk: '#c8456f',
  cardO: '#f3f0e8',
  cardOBorder: '#e2dcce',
  cardOInk: '#867d95',
  relParent: '#6d4ee0',
  relChild: '#1f9d7e',
  relPartner: '#c8456f',
  relEx: '#a9772f',
  relSibling: '#3f72c8',
  relOther: '#867d95',
  danger: '#dc2626',
  success: '#1f9d7e',
  scrim: 'rgba(40,30,60,0.32)',
};

// Resolve a palette for a given mode + accent choice.
export function makePalette(mode: ThemeMode, accent: AccentKey = 'violet'): Palette {
  const base = mode === 'dark' ? darkBase : lightBase;
  return { ...base, ...ACCENTS[accent][mode] };
}

// Static exports keep the violet default (used by the default context + tooling).
export const dark = darkBase;
export const light = lightBase;

// Accent swatches shown in the settings picker.
export const ACCENT_SWATCHES: { key: AccentKey; dot: string }[] = [
  { key: 'violet', dot: '#a78bff' },
  { key: 'teal', dot: '#3fd6c0' },
  { key: 'gold', dot: '#ffce6b' },
];

// Aurora backdrop colour pairs (Settings → Ambience → Glow colour). Two radial
// blobs per preset — index 0 paints the top-left blob, 1 the bottom-right.
export type AuroraKey = 'violet' | 'teal' | 'gold' | 'rose' | 'sky';
export const AURORA_PRESETS: Record<AuroraKey, [string, string]> = {
  violet: ['#8b6bff', '#cf6bd0'],
  teal:   ['#3fd6c0', '#5f8bff'],
  gold:   ['#ffce6b', '#ff8a5f'],
  rose:   ['#ff6b9d', '#a78bff'],
  sky:    ['#6bb8ff', '#8b6bff'],
};
export const AURORA_KEYS = Object.keys(AURORA_PRESETS) as AuroraKey[];

export const radius = { sm: 8, md: 13, lg: 16, xl: 24, pill: 999 };
export const space = (n: number) => n * 4;

// Font family map (loaded via expo-google-fonts in fonts.ts). RN custom fonts
// need an exact family per weight — never rely on fontWeight synthesis.
// UPRIGHT only: the design + user brief call for sharp, professional type with
// ~zero italics, so the old serif-italic keys now map to upright Spectral.
export const font = {
  serif: 'Spectral_600SemiBold',
  serifMed: 'Spectral_500Medium',
  serifBold: 'Spectral_700Bold',
  serifItalic: 'Spectral_600SemiBold',    // upright on purpose (no italics)
  serifMedItalic: 'Spectral_500Medium',   // upright on purpose (no italics)
  sans: 'HankenGrotesk_400Regular',
  sansMed: 'HankenGrotesk_500Medium',
  sansSemi: 'HankenGrotesk_600SemiBold',
  sansBold: 'HankenGrotesk_700Bold',
  sansHeavy: 'HankenGrotesk_800ExtraBold',
  mono: 'SplineSansMono_400Regular',
  monoMed: 'SplineSansMono_500Medium',
  monoSemi: 'SplineSansMono_600SemiBold',
};

// Gendered card tint helper (matches design's genderTint()).
export const genderTint = (c: Palette, g?: string) =>
  g === 'female'
    ? { bg: c.cardF, brd: c.cardFBorder, ink: c.cardFInk }
    : g === 'other'
    ? { bg: c.cardO, brd: c.cardOBorder, ink: c.cardOInk }
    : { bg: c.cardM, brd: c.cardMBorder, ink: c.cardMInk };

export interface ThemeCtx {
  c: Palette;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
}

export const ThemeContext = createContext<ThemeCtx>({
  c: dark,
  mode: 'dark',
  setMode: () => {},
  toggle: () => {},
  accent: 'violet',
  setAccent: () => {},
});

export const useTheme = () => useContext(ThemeContext);

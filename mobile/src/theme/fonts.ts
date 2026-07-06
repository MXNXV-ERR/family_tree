// Loads the "Aurora × Constellation" type system: Spectral (UPRIGHT serif
// display — no italics loaded, per the design brief), Hanken Grotesk (body),
// Spline Sans Mono (meta). Works on native and web (expo-font injects @font-face
// on web). Family names are referenced from src/theme/theme.ts `font.*`.
import { useFonts } from 'expo-font';
import {
  Spectral_400Regular,
  Spectral_500Medium,
  Spectral_600SemiBold,
  Spectral_700Bold,
} from '@expo-google-fonts/spectral';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  SplineSansMono_400Regular,
  SplineSansMono_500Medium,
  SplineSansMono_600SemiBold,
} from '@expo-google-fonts/spline-sans-mono';

export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Spectral_400Regular,
    Spectral_500Medium,
    Spectral_600SemiBold,
    Spectral_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    SplineSansMono_400Regular,
    SplineSansMono_500Medium,
    SplineSansMono_600SemiBold,
  });
  // Proceed even if a font fails to load — falling back to system fonts beats a
  // permanent loading gate (a single 404/decode error would otherwise blank the
  // whole app, as happened when the .ttf assets weren't deployed).
  return loaded || !!error;
}

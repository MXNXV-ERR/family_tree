// Loads the design type system: Newsreader (serif display), Plus Jakarta Sans
// (body), Spline Sans Mono (meta). Works on native and web (expo-font injects
// @font-face on web).
import { useFonts } from 'expo-font';
import {
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold_Italic,
} from '@expo-google-fonts/newsreader';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SplineSansMono_400Regular,
  SplineSansMono_500Medium,
  SplineSansMono_600SemiBold,
} from '@expo-google-fonts/spline-sans-mono';

export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_500Medium_Italic,
    Newsreader_600SemiBold_Italic,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    SplineSansMono_400Regular,
    SplineSansMono_500Medium,
    SplineSansMono_600SemiBold,
  });
  // Proceed even if a font fails to load — falling back to system fonts beats a
  // permanent loading gate (a single 404/decode error would otherwise blank the
  // whole app, as happened when the .ttf assets weren't deployed).
  return loaded || !!error;
}

// Cross-platform key/value for small prefs. On WEB we hit localStorage directly
// (AsyncStorage's web backend wasn't persisting here, which dropped the active-
// family choice on reload); on native we use AsyncStorage.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function kvGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  try { return await AsyncStorage.getItem(key); } catch { return null; }
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.setItem(key, value); } catch { /* ignore */ }
    return;
  }
  try { await AsyncStorage.setItem(key, value); } catch { /* ignore */ }
}

// Haptic beats for the celebration (SPEC §9). Native-only: every call is a
// no-op on web and inside runtimes without the native module, so callers never
// need to branch. Also silenced when the app's motion setting is off — a device
// buzzing through a reduced-motion sequence is the same intrusion as the motion.
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const safe = (fn: () => Promise<unknown>) => {
  if (!supported) return;
  try { fn().catch(() => {}); } catch { /* module missing in this runtime */ }
};

/** One deep thud — the crown bloom. */
export const thud = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** One soft tap — the sender landing in the opener. */
export const tap = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));

/** One tick — a link reaching its token. */
export const tick = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Opening / posting a wish. */
export const press = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

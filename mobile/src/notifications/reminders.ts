// Local notification scheduling for birthday / anniversary reminders.
// Native-only: scheduled local notifications don't exist on web, and inside
// Expo Go (SDK 53+) they need a dev build — callers surface that gracefully.
// All notifications we own are tagged so a re-sync can cancel just ours.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { upcomingReminders } from '../shared/reminders';
import type { Member, Relationship } from '../shared/types';

export const remindersSupported = Platform.OS !== 'web';

const TAG = 'family-reminder';
// iOS caps pending local notifications at 64 — keep headroom.
const MAX_SCHEDULED = 48;

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false,
      shouldShowBanner: true, shouldShowList: true,
    }),
  });
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  ensureHandler();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Family reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

// Cancel our previously-scheduled reminders, then schedule the next window.
// Returns how many are scheduled, or -1 when unsupported / denied.
export async function syncReminders(members: Member[], relationships: Relationship[]): Promise<number> {
  if (!remindersSupported) return -1;
  ensureHandler();
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((n) => (n.content.data as any)?.tag === TAG)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
    const items = upcomingReminders(members, relationships).slice(0, MAX_SCHEDULED);
    for (const r of items) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: r.title,
          body: r.body,
          data: { tag: TAG, kind: r.kind, memberIds: r.memberIds },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.date,
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : null),
        } as Notifications.NotificationTriggerInput,
      });
    }
    return items.length;
  } catch {
    // Expo Go on SDK 53+ throws for scheduling — needs a dev build.
    return -1;
  }
}

export async function clearReminders(): Promise<void> {
  if (!remindersSupported) return;
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((n) => (n.content.data as any)?.tag === TAG)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
  } catch { /* unsupported runtime */ }
}

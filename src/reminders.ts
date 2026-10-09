/**
 * bloop — Poop o'clock: one daily local notification at a fixed time.
 * Everything runs on-device (no server).
 *
 * HARDENED after the build-9 launch crash: expo-notifications (a native
 * module) is loaded LAZILY inside each function and every call is guarded,
 * so even a broken native module can never crash the app at startup —
 * reminders would simply no-op.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS, parseJSON } from './core';

export interface ReminderSettings {
  enabled: boolean;
  hour: number; // 0-23
  minute: number; // 0-59
}

export const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  hour: 10,
  minute: 30,
};

const MESSAGES = [
  "Poop o'clock! 🧻 The throne awaits — and it pays by the minute.",
  'Time to get paid. 💸 Clock in at your second office.',
  'Your daily bloop is calling. Answer it. 🚽',
] as const;

/* ---------------------- lazy, crash-proof native access ------------------ */

type NotificationsModule = typeof import('expo-notifications');

// Metro provides require at runtime; declare it for TypeScript.
declare const require: (module: string) => unknown;

let cached: NotificationsModule | null | undefined;

/** Load expo-notifications once, safely. Returns null when unavailable. */
const getNotifications = (): NotificationsModule | null => {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-notifications') as NotificationsModule;
    try {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      /* handler registration is best-effort */
    }
    cached = mod;
  } catch {
    cached = null;
  }
  return cached;
};

/* ------------------------------ settings -------------------------------- */

export const loadReminder = async (): Promise<ReminderSettings> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.reminder).catch(() => null);
  return parseJSON<ReminderSettings>(raw, DEFAULT_REMINDER);
};

/** Master switch: when off, bloop never schedules or fires notifications. */
export const notificationsEnabled = async (): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.notifications).catch(() => null);
  return raw !== 'false'; // default ON
};

export const setNotificationsEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.notifications, String(enabled)).catch(() => {});
  const N = getNotifications();
  if (!N) return;
  try {
    if (!enabled) {
      await N.cancelAllScheduledNotificationsAsync();
    } else {
      const settings = await loadReminder();
      if (settings.enabled) await applyReminder(settings);
    }
  } catch {
    /* non-fatal */
  }
};

/** Ask for permission. Returns true when notifications are allowed. */
export const requestPermission = async (): Promise<boolean> => {
  const N = getNotifications();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await N.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
};

/**
 * Persist + apply the settings: cancels any previous schedule, then (when
 * enabled) schedules the daily repeating notification.
 */
export const applyReminder = async (settings: ReminderSettings): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.reminder, JSON.stringify(settings)).catch(() => {});
  const N = getNotifications();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    if (!settings.enabled) return;
    if (!(await notificationsEnabled())) return; // master switch wins

    const body = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    await N.scheduleNotificationAsync({
      content: { title: "Poop o'clock ⏰", body, sound: 'default' },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour: settings.hour,
        minute: settings.minute,
      },
    });
  } catch {
    /* non-fatal */
  }
};

/** Immediate "still there?" ping (used by the 40-minute session guard). */
export const notifyStillThere = async (): Promise<void> => {
  if (!(await notificationsEnabled())) return;
  const N = getNotifications();
  if (!N) return;
  try {
    await N.scheduleNotificationAsync({
      content: {
        title: 'Still blooping? 🧻',
        body: "40 minutes on the throne — we're pausing the money clock for you.",
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    /* non-fatal */
  }
};

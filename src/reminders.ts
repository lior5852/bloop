/**
 * bloop — Poop o'clock: one daily local notification at a fixed time.
 * Everything runs on-device (no server). The OS keeps the schedule alive
 * even when the app is closed.
 */
import * as Notifications from 'expo-notifications';
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

/** Show alerts even when the app is foregrounded. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const loadReminder = async (): Promise<ReminderSettings> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.reminder).catch(() => null);
  return parseJSON<ReminderSettings>(raw, DEFAULT_REMINDER);
};

/** Ask for permission. Returns true when notifications are allowed. */
export const requestPermission = async (): Promise<boolean> => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
};

/**
 * Persist + apply the settings: cancels any previous schedule, then (when
 * enabled) schedules the daily repeating notification.
 */
export const applyReminder = async (settings: ReminderSettings): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.reminder, JSON.stringify(settings)).catch(() => {});
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  if (!settings.enabled) return;

  const body = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Poop o'clock ⏰",
      body,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.hour,
      minute: settings.minute,
    },
  });
};

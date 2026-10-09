/**
 * bloop — Poop o'clock settings sheet: enable + pick a daily time with
 * chunky sticker steppers (no native picker dependency needed).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';

import {
  SheetHeader,
  useThemed,
  stickerOf,
  stickerSmOf,
  haptic,
  SPACING,
  type ThemeColors,
} from './ui';
import {
  loadReminder,
  applyReminder,
  requestPermission,
  DEFAULT_REMINDER,
  type ReminderSettings,
} from './reminders';

const pad2 = (n: number): string => String(n).padStart(2, '0');

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ReminderScreen: React.FC<Props> = ({ visible, onClose }) => {
  const { styles, ui, colors: COLORS } = useThemed(makeStyles);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) loadReminder().then(setSettings).catch(() => {});
  }, [visible]);

  const bump = (field: 'hour' | 'minute', delta: number): void => {
    haptic.light();
    setSettings((s) => {
      const max = field === 'hour' ? 24 : 60;
      const next = (s[field] + delta + max) % max;
      return { ...s, [field]: next };
    });
  };

  const handleSave = useCallback(async (): Promise<void> => {
    setSaving(true);
    try {
      if (settings.enabled) {
        const ok = await requestPermission();
        if (!ok) {
          Alert.alert(
            'Notifications are off',
            'Allow notifications for bloop in Settings so Poop o’clock can ring.',
          );
          setSaving(false);
          return;
        }
      }
      await applyReminder(settings);
      haptic.success();
      Alert.alert(
        settings.enabled ? 'Scheduled! ⏰' : 'Reminder off',
        settings.enabled
          ? `Every day at ${pad2(settings.hour)}:${pad2(settings.minute)} — the throne will call.`
          : 'No more daily calls. Bloop freestyle.',
      );
      onClose();
    } catch {
      Alert.alert('Oops', 'Could not schedule the reminder. Try again.');
    } finally {
      setSaving(false);
    }
  }, [settings, onClose]);

  const stepper = (field: 'hour' | 'minute', value: number): React.JSX.Element => (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepBtn}
        accessibilityLabel={`Increase ${field}`}
        onPress={() => bump(field, 1)}
      >
        <Text style={styles.stepBtnText}>▲</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{pad2(value)}</Text>
      <TouchableOpacity
        style={styles.stepBtn}
        accessibilityLabel={`Decrease ${field}`}
        onPress={() => bump(field, -1)}
      >
        <Text style={styles.stepBtnText}>▼</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={ui.root}>
        <SheetHeader title="Poop o'clock" onClose={onClose} />
        <View style={styles.body}>
          <Text style={styles.emoji}>⏰🧻</Text>
          <Text style={styles.lead}>
            Pick your sacred daily time. We'll ring, you earn.
          </Text>

          <View style={styles.rowCard}>
            <Text style={styles.rowLabel}>Daily reminder</Text>
            <Switch
              value={settings.enabled}
              onValueChange={(v: boolean) => {
                haptic.light();
                setSettings((s) => ({ ...s, enabled: v }));
              }}
              trackColor={{ false: COLORS.hairline, true: COLORS.accent }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={[styles.timeCard, !settings.enabled && styles.dimmed]}>
            {stepper('hour', settings.hour)}
            <Text style={styles.colon}>:</Text>
            {stepper('minute', settings.minute)}
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            activeOpacity={0.85}
            disabled={saving}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>
              {settings.enabled ? 'Schedule it 🚀' : 'Save'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Runs fully on your phone — no server, no data, just vibes (and vibration).
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (COLORS: ThemeColors) => {
  const STICKER = stickerOf(COLORS);
  const STICKER_SM = stickerSmOf(COLORS);
  return StyleSheet.create({
    body: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
    emoji: { fontSize: 44, textAlign: 'center' },
    lead: {
      fontSize: 15,
      fontWeight: '600',
      color: COLORS.subtle,
      textAlign: 'center',
      marginTop: SPACING.xs,
      marginBottom: SPACING.lg,
    },
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: COLORS.card,
      borderRadius: 18,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginBottom: SPACING.md,
      ...STICKER_SM,
    },
    rowLabel: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
    timeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.card,
      borderRadius: 22,
      paddingVertical: SPACING.lg,
      marginBottom: SPACING.lg,
      ...STICKER,
    },
    dimmed: { opacity: 0.45 },
    stepper: { alignItems: 'center', gap: 6 },
    stepBtn: {
      width: 44,
      height: 34,
      borderRadius: 10,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...STICKER_SM,
      shadowOffset: { width: 2, height: 2 },
    },
    stepBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
    stepValue: {
      fontSize: 44,
      fontWeight: '800',
      color: COLORS.ink,
      fontVariant: ['tabular-nums'],
      minWidth: 70,
      textAlign: 'center',
    },
    colon: { fontSize: 40, fontWeight: '800', color: COLORS.subtle, marginHorizontal: 6 },
    saveButton: {
      backgroundColor: COLORS.accent,
      borderRadius: 18,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...STICKER,
    },
    saveButtonText: { fontSize: 18, fontWeight: '800', color: COLORS.white },
    hint: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.subtle,
      textAlign: 'center',
      marginTop: SPACING.md,
    },
  });
};

export default ReminderScreen;

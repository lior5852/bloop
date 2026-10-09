/**
 * bloop — Settings: master notification switch, email updates opt-in, and
 * the official Instagram link.
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
  Linking,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SheetHeader,
  useThemed,
  stickerSmOf,
  haptic,
  SPACING,
  type ThemeColors,
} from './ui';
import { notificationsEnabled, setNotificationsEnabled } from './reminders';
import { STORAGE_KEYS } from './core';

export const INSTAGRAM_URL = 'https://www.instagram.com/bloop.now/';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SettingsScreen: React.FC<Props> = ({ visible, onClose }) => {
  const { styles, ui, colors: COLORS } = useThemed(makeStyles);
  const [notifs, setNotifs] = useState(true);
  const [emailOptIn, setEmailOptIn] = useState(false);

  useEffect(() => {
    if (!visible) return;
    notificationsEnabled().then(setNotifs).catch(() => {});
    AsyncStorage.getItem(STORAGE_KEYS.emailOptIn)
      .then((v: string | null) => setEmailOptIn(v === 'true'))
      .catch(() => {});
  }, [visible]);

  const toggleNotifs = useCallback(async (value: boolean): Promise<void> => {
    haptic.light();
    setNotifs(value);
    await setNotificationsEnabled(value);
    if (!value) {
      Alert.alert('Notifications off', "Poop o'clock and session pings are silenced. 🤫");
    }
  }, []);

  const toggleEmail = useCallback(async (value: boolean): Promise<void> => {
    haptic.light();
    setEmailOptIn(value);
    await AsyncStorage.setItem(STORAGE_KEYS.emailOptIn, String(value)).catch(() => {});
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={ui.root}>
        <SheetHeader title="Settings" onClose={onClose} />
        <View style={styles.body}>
          <Text style={ui.sectionLabel}>Notifications</Text>
          <View style={styles.rowCard}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>App notifications</Text>
              <Text style={styles.rowHint}>Poop o'clock & session reminders</Text>
            </View>
            <Switch
              value={notifs}
              onValueChange={toggleNotifs}
              trackColor={{ false: COLORS.hairline, true: COLORS.accent }}
              thumbColor={COLORS.white}
            />
          </View>

          <Text style={ui.sectionLabel}>Updates</Text>
          <View style={styles.rowCard}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Email updates</Text>
              <Text style={styles.rowHint}>News, rewards & launches (no spam, ever)</Text>
            </View>
            <Switch
              value={emailOptIn}
              onValueChange={toggleEmail}
              trackColor={{ false: COLORS.hairline, true: COLORS.accent }}
              thumbColor={COLORS.white}
            />
          </View>

          <Text style={ui.sectionLabel}>Community</Text>
          <TouchableOpacity
            style={styles.rowCard}
            activeOpacity={0.85}
            onPress={() => {
              haptic.light();
              Linking.openURL(INSTAGRAM_URL).catch(() => {});
            }}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>📸 Follow @bloop.now</Text>
              <Text style={styles.rowHint}>Memes, merch drops & launch news</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (COLORS: ThemeColors) => {
  const STICKER_SM = stickerSmOf(COLORS);
  return StyleSheet.create({
    body: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: COLORS.card,
      borderRadius: 18,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginBottom: SPACING.lg,
      ...STICKER_SM,
    },
    rowText: { flex: 1, paddingRight: SPACING.sm },
    rowLabel: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
    rowHint: { fontSize: 12, fontWeight: '600', color: COLORS.subtle, marginTop: 2 },
    chevron: { fontSize: 24, fontWeight: '700', color: COLORS.subtle },
  });
};

export default SettingsScreen;

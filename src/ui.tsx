/**
 * bloop — shared theme + tiny UI building blocks.
 * One source of truth for colors/sticker style (was copy-pasted in 4 files).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

// BLOOP brand: cream background, bold orange, thick ink outlines, teal for money.
export const COLORS = {
  background: '#FDF3E3',
  card: '#FFFDF8',
  primary: '#F4772E',
  accent: '#2BBFA4',
  mint: '#1D9E82',
  mintBg: '#DFF5EF',
  peach: '#FFE8D6',
  ink: '#1B1511',
  subtle: '#8A7B6D',
  danger: '#E24B4A',
  hairline: '#F0E4D0',
  white: '#FFFFFF',
  backdrop: 'rgba(30, 27, 46, 0.45)',
} as const;

/** Sticker-style hard shadow + thick outline. */
export const STICKER = {
  borderWidth: 3,
  borderColor: COLORS.ink,
  shadowColor: COLORS.ink,
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
} as const;

/** Smaller sticker for compact cards. */
export const STICKER_SM = {
  ...STICKER,
  borderWidth: 2.5,
  shadowOffset: { width: 3, height: 3 },
} as const;

export const SPACING = { xs: 6, sm: 12, md: 16, lg: 24, xl: 32 } as const;

/* ------------------------------ Haptics --------------------------------- */

const ignore = (): void => {};
export const haptic = {
  light: (): void => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore),
  heavy: (): void => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore),
  success: (): void =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore),
};

/* ----------------------------- Components ------------------------------- */

/** Title + ✕ header used by every page-sheet modal. */
export const SheetHeader: React.FC<{ title: string; onClose: () => void }> = ({
  title,
  onClose,
}) => (
  <View style={ui.header}>
    <Text style={ui.title}>{title}</Text>
    <TouchableOpacity
      style={ui.closeButton}
      onPress={onClose}
      accessibilityLabel={`Close ${title}`}
    >
      <Text style={ui.closeText}>✕</Text>
    </TouchableOpacity>
  </View>
);

/** 0..1 progress bar. */
export const ProgressBar: React.FC<{ value: number; height?: number }> = ({
  value,
  height = 6,
}) => (
  <View style={[ui.track, { height }]}>
    <View style={[ui.fill, { height, width: `${value * 100}%` }]} />
  </View>
);

/** Shared styles reused across screens. */
export const ui = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.ink },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 16, fontWeight: '700', color: COLORS.subtle },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  track: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.hairline,
    marginTop: 6,
    overflow: 'hidden',
  },
  fill: { borderRadius: 999, backgroundColor: COLORS.mint },
  mintText: { color: COLORS.mint },
  dangerText: { color: COLORS.danger },
});

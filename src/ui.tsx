/**
 * bloop — theme system + shared UI building blocks.
 *
 * Two themes share one shape: DAY (orange sticker) and NIGHT (purple neon).
 * Components call `useThemed(makeStyles)` to get { colors, ui, styles, mode,
 * toggle } — styles are rebuilt only when the mode flips (memoized).
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

/* ------------------------------- Palettes -------------------------------- */

export const DAY = {
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

/** Night: deep purple surfaces, light "neon" outlines, same sticker spirit. */
export const NIGHT: ThemeColors = {
  background: '#221A3E',
  card: '#2F2554',
  primary: '#8B5CF6',
  accent: '#2BD4B4',
  mint: '#4ADE9F',
  mintBg: '#1E3A34',
  peach: '#443069',
  ink: '#F2ECFF',
  subtle: '#B6A7DC',
  danger: '#FF7B7B',
  hairline: '#473A72',
  white: '#FFFFFF',
  backdrop: 'rgba(0, 0, 0, 0.6)',
};

export type ThemeColors = { [K in keyof typeof DAY]: string };
export type ThemeMode = 'day' | 'night';

const THEME_STORAGE_KEY = '@bloop:theme';

/** Legacy static exports (day values) — prefer useThemed() in components. */
export const COLORS: ThemeColors = DAY;

/** Sticker-style hard shadow + thick outline for a given palette. */
export const stickerOf = (c: ThemeColors) =>
  ({
    borderWidth: 3,
    borderColor: c.ink,
    shadowColor: c.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  }) as const;

export const stickerSmOf = (c: ThemeColors) =>
  ({
    ...stickerOf(c),
    borderWidth: 2.5,
    shadowOffset: { width: 3, height: 3 },
  }) as const;

export const STICKER = stickerOf(DAY);
export const STICKER_SM = stickerSmOf(DAY);

export const SPACING = { xs: 6, sm: 12, md: 16, lg: 24, xl: 32 } as const;

/* ------------------------------ Haptics --------------------------------- */

const ignore = (): void => {};
export const haptic = {
  light: (): void => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore),
  heavy: (): void => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore),
  success: (): void =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore),
};

/* ------------------------------- Context --------------------------------- */

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isNight: boolean;
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeContextValue>({
  mode: 'day',
  colors: DAY,
  isNight: false,
  toggle: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('day');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((v: string | null) => {
        if (v === 'night') setMode('night');
      })
      .catch(ignore);
  }, []);

  const toggle = useCallback((): void => {
    setMode((m) => {
      const next: ThemeMode = m === 'day' ? 'night' : 'day';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(ignore);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, colors: mode === 'day' ? DAY : NIGHT, isNight: mode === 'night', toggle }),
    [mode, toggle],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
};

/* ---------------------------- Shared styles ------------------------------ */

const makeUi = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    title: { fontSize: 24, fontWeight: '800', color: c.ink },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: { fontSize: 16, fontWeight: '700', color: c.subtle },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: c.subtle,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    track: {
      width: '100%',
      borderRadius: 999,
      backgroundColor: c.hairline,
      marginTop: 6,
      overflow: 'hidden',
    },
    fill: { borderRadius: 999, backgroundColor: c.mint },
    mintText: { color: c.mint },
    dangerText: { color: c.danger },
  });

const uiCache: Partial<Record<ThemeMode, ReturnType<typeof makeUi>>> = {};

/** Legacy static ui (day) — prefer the `ui` returned by useThemed(). */
export const ui = makeUi(DAY);

/* -------------------------------- Hooks ---------------------------------- */

export const useTheme = (): ThemeContextValue => useContext(ThemeCtx);

/**
 * One-liner for themed components:
 *   const { colors, ui, styles } = useThemed(makeStyles);
 * `factory` must be a module-level constant so memoization holds.
 */
export function useThemed<T>(
  factory?: (c: ThemeColors) => T,
): ThemeContextValue & { ui: ReturnType<typeof makeUi>; styles: T } {
  const ctx = useContext(ThemeCtx);
  const uiStyles =
    uiCache[ctx.mode] ?? (uiCache[ctx.mode] = makeUi(ctx.colors));
  const styles = useMemo(
    () => (factory ? factory(ctx.colors) : (undefined as unknown as T)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.mode, factory],
  );
  return { ...ctx, ui: uiStyles, styles };
}

/* ----------------------------- Components ------------------------------- */

/** Title + ✕ header used by every page-sheet modal. */
export const SheetHeader: React.FC<{ title: string; onClose: () => void }> = ({
  title,
  onClose,
}) => {
  const { ui: u } = useThemed();
  return (
    <View style={u.header}>
      <Text style={u.title}>{title}</Text>
      <TouchableOpacity
        style={u.closeButton}
        onPress={onClose}
        accessibilityLabel={`Close ${title}`}
      >
        <Text style={u.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

/** 0..1 progress bar. */
export const ProgressBar: React.FC<{ value: number; height?: number }> = ({
  value,
  height = 6,
}) => {
  const { ui: u } = useThemed();
  return (
    <View style={[u.track, { height }]}>
      <View style={[u.fill, { height, width: `${value * 100}%` }]} />
    </View>
  );
};

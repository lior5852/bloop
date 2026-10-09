import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';

import SurveysScreen from './src/SurveysScreen';
import StatsScreen from './src/StatsScreen';
import FriendsScreen from './src/FriendsScreen';
import ReminderScreen from './src/ReminderScreen';
import { syncMyStats } from './src/friends';
import { SOCIAL_LOGIN_ENABLED } from './src/config';
import {
  signInWithApple,
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  signOut as authSignOut,
  getCurrentUser,
  AuthError,
} from './src/auth';
import {
  SPACING,
  haptic,
  ProgressBar,
  ThemeProvider,
  useThemed,
  stickerOf,
  stickerSmOf,
  type ThemeColors,
} from './src/ui';
import {
  CURRENCY,
  CURRENCIES,
  setCurrency,
  STORAGE_KEYS,
  ALL_STORAGE_KEYS,
  WITHDRAW_THRESHOLD,
  earningsFor,
  addSession,
  addToDaily,
  formatTime,
  money,
  totalMinutes,
  parseWage,
  isValidEmail,
  isValidName,
  makeUser,
  emptyStats,
  emptyWallet,
  emptyDaily,
  withdrawProgress,
  parseJSON,
  type DailyStore,
  type User,
  type LifetimeStats,
  type Wallet,
  type SessionResult,
} from './src/core';

const LOTTIE_URL =
  'https://lottie.host/4db68bbd-31f6-4cd8-84c2-8dcbe5c0b657/eBiVsBfaS4.json';

/** bloop on the web — the shop button opens this. */
export const SHOP_URL = 'https://bloop-app-kravi11.vercel.app/shop';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.82);

type AppScreen = 'loading' | 'auth' | 'wage' | 'main';
/** Which full-screen sheet is open — they are mutually exclusive. */
type Sheet = 'none' | 'wage' | 'surveys' | 'stats' | 'friends' | 'reminder';

/**
 * Persist key/value pairs in ONE batched write; strings stored raw, the rest
 * as JSON. AsyncStorage v3 renamed multiSet/multiGet/multiRemove to
 * setMany/getMany/removeMany — the old names are undefined at runtime.
 */
const save = (pairs: Array<[string, unknown]>): void => {
  AsyncStorage.setMany(
    Object.fromEntries(pairs.map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])),
  ).catch(() => {});
};

/* -------------------------------------------------------------------------- */
/*                            Mascot (brand mark)                              */
/* -------------------------------------------------------------------------- */
/* The winking toilet-roll from the BLOOP sticker logo, drawn with views so it
 * needs no asset and scales crisply. */

const Mascot: React.FC<{ size?: number }> = ({ size = 46 }) => {
  const { colors: COLORS } = useThemed();
  const k = size / 46;
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: COLORS.primary,
        borderWidth: 2.5 * k,
        borderColor: COLORS.ink,
        borderRadius: 12 * k,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.ink,
        shadowOffset: { width: 2 * k, height: 2 * k },
        shadowOpacity: 1,
        shadowRadius: 0,
      }}
      accessibilityLabel="bloop mascot"
    >
      <View
        style={{
          width: 30 * k,
          height: 25 * k,
          backgroundColor: COLORS.card,
          borderWidth: 2 * k,
          borderColor: COLORS.ink,
          borderRadius: 7 * k,
        }}
      >
        <View
          style={{
            position: 'absolute',
            right: 3 * k,
            top: 3 * k,
            width: 8 * k,
            height: 8 * k,
            borderWidth: 2 * k,
            borderColor: COLORS.ink,
            borderRadius: 5 * k,
            backgroundColor: COLORS.card,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 5 * k,
            top: 8 * k,
            width: 3 * k,
            height: 3 * k,
            borderRadius: 2 * k,
            backgroundColor: COLORS.ink,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 11 * k,
            top: 9 * k,
            width: 6 * k,
            height: 3 * k,
            borderBottomWidth: 2 * k,
            borderColor: COLORS.ink,
            borderBottomLeftRadius: 4 * k,
            borderBottomRightRadius: 4 * k,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 7 * k,
            bottom: 3 * k,
            width: 12 * k,
            height: 5 * k,
            borderBottomWidth: 2 * k,
            borderColor: COLORS.ink,
            borderBottomLeftRadius: 6 * k,
            borderBottomRightRadius: 6 * k,
          }}
        />
      </View>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                 Confetti                                    */
/* -------------------------------------------------------------------------- */

const CONFETTI_PIECES = ['🎉', '💸', '🪙', '✨', '💰', '🎊'] as const;

interface ConfettiPiece {
  emoji: string;
  x: number;
  delay: number;
  size: number;
}

const makeConfetti = (count: number): ConfettiPiece[] =>
  Array.from({ length: count }, (_, i) => ({
    emoji: CONFETTI_PIECES[i % CONFETTI_PIECES.length],
    x: Math.random() * (SCREEN_WIDTH - 40),
    delay: Math.random() * 400,
    size: 18 + Math.random() * 14,
  }));

const Confetti: React.FC<{ burstKey: number }> = ({ burstKey }) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (burstKey === 0) return;
    setPieces(makeConfetti(18));
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(
      () => setPieces([]),
    );
  }, [burstKey, anim]);

  if (pieces.length === 0) return null;

  const opacity = anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.Text
          key={`${burstKey}-${i}`}
          style={{
            position: 'absolute',
            top: 0,
            left: p.x,
            fontSize: p.size,
            opacity,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-60, 640 + p.delay] }) },
              { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', i % 2 ? '-360deg' : '360deg'] }) },
            ],
          }}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                Auth screen                                 */
/* -------------------------------------------------------------------------- */

interface AuthProps {
  onEmailSignUp: (username: string, email: string, password: string, confirm: string) => void;
  onEmailLogin: (email: string, password: string) => void;
  onGuest: () => void;
  onSocial: (provider: 'apple' | 'google') => void;
  busy: boolean;
}

const AuthScreen: React.FC<AuthProps> = ({
  onEmailSignUp,
  onEmailLogin,
  onGuest,
  onSocial,
  busy,
}) => {
  const { styles, ui, colors: COLORS } = useThemed(makeStyles);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const signup = mode === 'signup';

  const handleSubmit = (): void => {
    if (signup) onEmailSignUp(username, email, password, confirm);
    else onEmailLogin(email, password);
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    opts: { placeholder: string; secure?: boolean; emailKb?: boolean; last?: boolean },
  ): React.JSX.Element => (
    <>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.textField}
        value={value}
        onChangeText={set}
        placeholder={opts.placeholder}
        placeholderTextColor={COLORS.subtle}
        secureTextEntry={opts.secure}
        keyboardType={opts.emailKb ? 'email-address' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={opts.last ? 'done' : 'next'}
        onSubmitEditing={opts.last ? handleSubmit : undefined}
      />
      {!opts.last && <View style={styles.fieldDivider} />}
    </>
  );

  return (
    <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={ui.flex}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.emoji}>🚽💸</Text>
          <Text style={styles.title}>bloop</Text>
          <Text style={styles.subtitle}>
            {signup
              ? 'Get paid to go. Create your account to start tracking every break.'
              : 'Welcome back! Log in to keep blooping.'}
          </Text>

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeTab, signup && styles.modeTabActive]}
              onPress={() => setMode('signup')}
            >
              <Text style={[styles.modeTabText, signup && styles.modeTabTextActive]}>Sign up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, !signup && styles.modeTabActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.modeTabText, !signup && styles.modeTabTextActive]}>Log in</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputCard}>
            {signup &&
              field('Username', username, setUsername, { placeholder: 'toilet_king_99' })}
            {field('Email', email, setEmail, { placeholder: 'name@email.com', emailKb: true, last: false })}
            {field('Password', password, setPassword, {
              placeholder: 'At least 8 characters',
              secure: true,
              last: !signup,
            })}
            {signup &&
              field('Confirm password', confirm, setConfirm, {
                placeholder: 'Same one again',
                secure: true,
                last: true,
              })}
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            disabled={busy}
            onPress={handleSubmit}
          >
            <Text style={styles.primaryButtonText}>
              {signup ? 'Create account 🎉' : 'Log in 🔑'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.guestLink} disabled={busy} onPress={onGuest}>
            <Text style={styles.guestLinkText}>Just let me bloop (continue as guest) →</Text>
          </TouchableOpacity>

          {SOCIAL_LOGIN_ENABLED && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton]}
                disabled={busy}
                onPress={() => onSocial('apple')}
              >
                <Text style={[styles.socialText, styles.white]}> Continue with Apple</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialButton, styles.googleButton]}
                disabled={busy}
                onPress={() => onSocial('google')}
              >
                <Text style={styles.socialText}>
                  <Text style={styles.googleLogo}>G </Text>Continue with Google
                </Text>
              </TouchableOpacity>
            </>
          )}

          {busy && <ActivityIndicator style={styles.authSpinner} color={COLORS.primary} />}

          <Text style={styles.footnote}>
            {signup
              ? 'Your account powers the friends leaderboard. Timer data stays on your device.'
              : 'Forgot your password? Email lior5852@gmail.com and we’ll sort you out.'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

/* -------------------------------------------------------------------------- */
/*                          Wage form (setup + edit)                          */
/* -------------------------------------------------------------------------- */

interface WageFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  initialValue?: string;
  onSubmit: (wage: number, currencySymbol: string) => void;
  onCancel?: () => void;
}

const WageForm: React.FC<WageFormProps> = ({
  title,
  subtitle,
  submitLabel,
  initialValue = '',
  onSubmit,
  onCancel,
}) => {
  const { styles, colors: COLORS } = useThemed(makeStyles);
  const [wage, setWage] = useState(initialValue);
  const [symbol, setSymbol] = useState(CURRENCY);

  const handleSubmit = (): void => {
    const parsed = parseWage(wage);
    if (parsed === null) return Alert.alert('Oops!', 'Please enter a valid hourly wage.');
    onSubmit(parsed, symbol);
  };

  return (
    <View style={styles.wageFormBody}>
      <Text style={styles.emoji}>💰</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.currencyRow}>
        {CURRENCIES.map((c) => {
          const active = symbol === c.symbol;
          return (
            <TouchableOpacity
              key={c.code}
              style={[styles.currencyPill, active && styles.currencyPillActive]}
              accessibilityLabel={`Use ${c.name}`}
              onPress={() => setSymbol(c.symbol)}
            >
              <Text style={[styles.currencyPillText, active && styles.white]}>
                {c.symbol} {c.code}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>Hourly wage</Text>
        <View style={styles.inputRow}>
          <Text style={styles.currencyPrefix}>{symbol}</Text>
          <TextInput
            style={styles.input}
            value={wage}
            onChangeText={setWage}
            placeholder="0.00"
            placeholderTextColor={COLORS.subtle}
            keyboardType="decimal-pad"
            returnKeyType="done"
            maxLength={9}
            autoFocus
            onSubmitEditing={handleSubmit}
          />
          <Text style={styles.perHour}>/ hr</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={handleSubmit}>
        <Text style={styles.primaryButtonText}>{submitLabel}</Text>
      </TouchableOpacity>

      {onCancel && (
        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.7} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                              Session summary                               */
/* -------------------------------------------------------------------------- */

const SummaryModal: React.FC<{
  visible: boolean;
  result: SessionResult | null;
  onClose: () => void;
}> = ({ visible, result, onClose }) => {
  const { styles, ui } = useThemed(makeStyles);
  return (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <View style={styles.grabber} />
        <Text style={styles.modalEmoji}>🎉</Text>
        <Text style={styles.modalTitle}>Break complete!</Text>
        <Text style={styles.modalSubtitle}>Here’s how you did.</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>{formatTime(result?.elapsedSeconds ?? 0)}</Text>
          </View>
          <View style={[styles.statBox, styles.mintBg]}>
            <Text style={styles.statLabel}>Earned</Text>
            <Text style={[styles.statValue, ui.mintText]}>{money(result?.amountEarned ?? 0)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={onClose}>
          <Text style={styles.primaryButtonText}>Nice! Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
  );
};

/* -------------------------------------------------------------------------- */
/*                                  Drawer                                     */
/* -------------------------------------------------------------------------- */

interface DrawerProps {
  open: boolean;
  user: User;
  stats: LifetimeStats;
  wallet: Wallet;
  onClose: () => void;
  onOpenSheet: (sheet: Sheet) => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
}

interface DrawerRow {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  extra?: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({
  open,
  user,
  stats,
  wallet,
  onClose,
  onOpenSheet,
  onDeleteAccount,
  onLogout,
}) => {
  const { styles, ui, isNight, toggle } = useThemed(makeStyles);
  const progress = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = open
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, { toValue: open ? 1 : 0, duration: 240, useNativeDriver: true }).start(
      ({ finished }: { finished: boolean }) => finished && !open && setMounted(false),
    );
  }, [open, progress]);

  if (!mounted) return null;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] });

  const rows: DrawerRow[] = [
    { icon: '📈', label: 'My stats', onPress: () => onOpenSheet('stats') },
    { icon: '👥', label: 'Friends & leaderboard', onPress: () => onOpenSheet('friends') },
    { icon: '✏️', label: 'Edit hourly wage', onPress: () => onOpenSheet('wage') },
    { icon: '⏰', label: "Poop o'clock reminder", onPress: () => onOpenSheet('reminder') },
    {
      icon: isNight ? '☀️' : '🌙',
      label: isNight ? 'Day mode' : 'Night mode',
      onPress: () => {
        haptic.light();
        toggle();
      },
    },
    {
      icon: '📝',
      label: 'Surveys & rewards',
      onPress: () => onOpenSheet('surveys'),
      extra: (
        <>
          <ProgressBar value={withdrawProgress(wallet)} />
          <Text style={styles.drawerSubtle}>
            {money(wallet.balance)} / {CURRENCY}
            {WITHDRAW_THRESHOLD} to withdraw
          </Text>
        </>
      ),
    },
    { icon: '🚪', label: 'Log out', onPress: onLogout },
    { icon: '🗑️', label: 'Delete account', onPress: onDeleteAccount, danger: true },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, { opacity: progress }]} pointerEvents={open ? 'auto' : 'none'}>
        <TouchableOpacity style={ui.flex} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <SafeAreaView style={ui.flex}>
          <ScrollView contentContainerStyle={styles.drawerContent}>
            <View style={styles.drawerHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.name.trim().slice(0, 1).toUpperCase() || 'U'}</Text>
              </View>
              <Text style={styles.drawerName}>{user.name}</Text>
              <Text style={styles.drawerEmail}>{user.email}</Text>
            </View>

            <Text style={styles.drawerSectionLabel}>Lifetime</Text>
            <View style={styles.drawerStatsRow}>
              <View style={styles.drawerStatBox}>
                <Text style={styles.drawerStatValue}>{totalMinutes(stats.totalSeconds)}</Text>
                <Text style={styles.drawerStatUnit}>minutes</Text>
              </View>
              <View style={[styles.drawerStatBox, styles.mintBg]}>
                <Text style={[styles.drawerStatValue, ui.mintText]}>{money(stats.totalEarned)}</Text>
                <Text style={styles.drawerStatUnit}>earned</Text>
              </View>
            </View>
            <Text style={styles.drawerHint}>
              {stats.sessions} session{stats.sessions === 1 ? '' : 's'} logged
            </Text>

            <Text style={styles.drawerSectionLabel}>Account</Text>
            {rows.map((r) => (
              <TouchableOpacity key={r.label} style={styles.drawerRow} onPress={r.onPress}>
                <Text style={styles.drawerRowIcon}>{r.icon}</Text>
                <View style={ui.flex}>
                  <Text style={[styles.drawerRowText, r.danger && ui.dangerText]}>{r.label}</Text>
                  {r.extra}
                </View>
                <Text style={[styles.drawerChevron, r.danger && ui.dangerText]}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                  Tracker                                    */
/* -------------------------------------------------------------------------- */
/*
 * The stopwatch lives in its own component so the per-second tick re-renders
 * only this card — not the header, drawer, or the stats/friends/surveys sheets.
 */

const Tracker: React.FC<{
  hourlyWage: number;
  onFinish: (result: SessionResult) => void;
}> = ({ hourlyWage, onFinish }) => {
  const { styles } = useThemed(makeStyles);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const running = startedAt !== null;

  // Derive seconds from the wall clock (never drifts); React skips the render
  // when the value is unchanged, so 4 ticks/s cost ~1 render/s.
  useEffect(() => {
    if (startedAt === null) return undefined;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (!running) {
      pulse.setValue(1);
      return undefined;
    }
    const beat = (toValue: number) =>
      Animated.timing(pulse, { toValue, duration: 600, useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([beat(1.08), beat(1)]));
    loop.start();
    return () => loop.stop();
  }, [running, pulse]);

  const handleStart = (): void => {
    haptic.heavy();
    setElapsed(0);
    setStartedAt(Date.now());
  };

  const handleFinish = (): void => {
    if (startedAt === null) return;
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    haptic.success();
    setStartedAt(null);
    setElapsed(0);
    onFinish({ elapsedSeconds: seconds, amountEarned: earningsFor(seconds, hourlyWage) });
  };

  return (
    <>
      <View style={styles.animationWrap}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <LottieView
            source={{ uri: LOTTIE_URL }}
            autoPlay
            loop={running}
            speed={running ? 1 : 0}
            style={styles.lottie}
          />
        </Animated.View>
      </View>

      <View style={styles.counterCard}>
        <Text style={styles.timerLabel}>{running ? 'Session in progress' : 'Ready when you are'}</Text>
        <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        <Text style={styles.earnedLabel}>You earned</Text>
        <Text style={styles.earnedValue}>{money(earningsFor(elapsed, hourlyWage))}</Text>
      </View>

      <TouchableOpacity
        style={[styles.bigButton, running ? styles.finishButton : styles.startButton]}
        activeOpacity={0.85}
        onPress={running ? handleFinish : handleStart}
      >
        <Text style={styles.bigButtonText}>{running ? 'Finish 🏁' : 'Start Session 🚀'}</Text>
      </TouchableOpacity>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*                               Main (tracker)                               */
/* -------------------------------------------------------------------------- */

interface MainProps {
  user: User;
  hourlyWage: number;
  stats: LifetimeStats;
  wallet: Wallet;
  daily: DailyStore;
  onFinishSession: (result: SessionResult) => void;
  onSaveWage: (wage: number, currencySymbol: string) => void;
  onWalletChange: (w: Wallet) => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
}

const MainScreen: React.FC<MainProps> = ({
  user,
  hourlyWage,
  stats,
  wallet,
  daily,
  onFinishSession,
  onSaveWage,
  onWalletChange,
  onDeleteAccount,
  onLogout,
}) => {
  const { styles, ui } = useThemed(makeStyles);
  const [summary, setSummary] = useState<SessionResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('none');
  const [confettiKey, setConfettiKey] = useState(0);

  const closeSheet = useCallback(() => setSheet('none'), []);

  const openSheet = (next: Sheet): void => {
    haptic.light();
    setDrawerOpen(false);
    setSheet(next);
  };

  const handleFinish = (result: SessionResult): void => {
    setSummary(result);
    setShowSummary(true);
    setConfettiKey((k) => k + 1);
    onFinishSession(result);
  };

  const confirmDelete = (): void => {
    setDrawerOpen(false);
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile, wage, and lifetime stats on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDeleteAccount },
      ],
    );
  };

  const statCards = [
    { label: 'Hourly wage', value: money(hourlyWage) },
    { label: 'Total time', value: String(totalMinutes(stats.totalSeconds)), unit: ' min' },
    { label: 'Total earned', value: money(stats.totalEarned), mint: true },
  ];

  return (
    <View style={ui.flex}>
      <SafeAreaView style={ui.flex}>
        <View style={styles.trackerContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.menuButton}
              activeOpacity={0.7}
              onPress={() => {
                haptic.light();
                setDrawerOpen(true);
              }}
            >
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
            <View style={styles.brandRow}>
              <Mascot size={40} />
              <Text style={styles.headerTitle}>BLOOP</Text>
            </View>
            <TouchableOpacity
              style={styles.menuButton}
              accessibilityLabel="Open the bloop shop"
              onPress={() => {
                haptic.light();
                Linking.openURL(SHOP_URL).catch(() => {});
              }}
            >
              <Text style={styles.menuIcon}>🛍</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.greeting}>
            Hi @{user.name}! Ready to turn breaks into bank? 🧻
          </Text>

          <View style={styles.wageStatsRow}>
            <TouchableOpacity
              style={styles.wageStatCard}
              activeOpacity={0.8}
              accessibilityLabel="Edit hourly wage"
              onPress={() => openSheet('wage')}
            >
              <Text style={styles.wageStatLabel}>Hourly wage ✏️</Text>
              <Text style={styles.wageStatValue}>{money(hourlyWage)}</Text>
            </TouchableOpacity>
            {statCards.slice(1).map((c) => (
              <View key={c.label} style={[styles.wageStatCard, c.mint && styles.mintBg]}>
                <Text style={styles.wageStatLabel}>{c.label}</Text>
                <Text style={[styles.wageStatValue, c.mint && ui.mintText]}>
                  {c.value}
                  {c.unit && <Text style={styles.wageStatUnit}>{c.unit}</Text>}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.friendsButton}
            activeOpacity={0.85}
            accessibilityLabel="Add friends and open the leaderboard"
            onPress={() => openSheet('friends')}
          >
            <Text style={styles.friendsButtonText}>👥 Add friends · race them to the throne 👑</Text>
          </TouchableOpacity>

          <Tracker hourlyWage={hourlyWage} onFinish={handleFinish} />

          {/* Ad slot placeholder — reserves layout space for a future ad network. */}
          <View style={styles.adBanner}>
            <Text style={styles.adBannerText}>Ad space · coming soon</Text>
          </View>
        </View>
      </SafeAreaView>

      <SummaryModal visible={showSummary} result={summary} onClose={() => setShowSummary(false)} />

      <Modal visible={sheet === 'wage'} transparent animationType="fade" onRequestClose={closeSheet}>
        <View style={styles.editBackdrop}>
          <View style={styles.editCard}>
            <WageForm
              title="Edit wage"
              subtitle="Update your hourly rate. It’s saved for next time."
              submitLabel="Save 💾"
              initialValue={String(hourlyWage)}
              onSubmit={(w, c) => {
                onSaveWage(w, c);
                closeSheet();
              }}
              onCancel={closeSheet}
            />
          </View>
        </View>
      </Modal>

      <Drawer
        open={drawerOpen}
        user={user}
        stats={stats}
        wallet={wallet}
        onClose={() => setDrawerOpen(false)}
        onOpenSheet={openSheet}
        onDeleteAccount={confirmDelete}
        onLogout={() => {
          setDrawerOpen(false);
          onLogout();
        }}
      />

      <SurveysScreen
        visible={sheet === 'surveys'}
        wallet={wallet}
        onWalletChange={onWalletChange}
        onClose={closeSheet}
      />
      <StatsScreen visible={sheet === 'stats'} stats={stats} daily={daily} onClose={closeSheet} />
      <FriendsScreen visible={sheet === 'friends'} stats={stats} onClose={closeSheet} />
      <ReminderScreen visible={sheet === 'reminder'} onClose={closeSheet} />

      <Confetti burstKey={confettiKey} />
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                   App                                       */
/* -------------------------------------------------------------------------- */

export default function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  );
}

function AppRoot(): React.JSX.Element {
  const { ui, colors, isNight, styles } = useThemed(makeStyles);
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [wage, setWage] = useState<number | null>(null);
  const [stats, setStats] = useState<LifetimeStats>(emptyStats);
  const [wallet, setWallet] = useState<Wallet>(emptyWallet);
  const [daily, setDaily] = useState<DailyStore>(emptyDaily);
  const [busy, setBusy] = useState(false);

  // One batched read of everything on launch.
  useEffect(() => {
    (async (): Promise<void> => {
      try {
        const map = await AsyncStorage.getMany([...ALL_STORAGE_KEYS]);

        const storedCurrency = map[STORAGE_KEYS.currency];
        if (storedCurrency) setCurrency(storedCurrency);

        setStats(parseJSON(map[STORAGE_KEYS.stats], emptyStats()));
        setWallet(parseJSON(map[STORAGE_KEYS.wallet], emptyWallet()));
        setDaily(parseJSON(map[STORAGE_KEYS.daily], emptyDaily()));

        // Prefer a live server session (Apple/Google); fall back to local user.
        const sessionUser = await getCurrentUser();
        const loadedUser = sessionUser ?? parseJSON<User | null>(map[STORAGE_KEYS.user], null);
        if (!loadedUser) return setScreen('auth');

        setUser(loadedUser);
        if (sessionUser) save([[STORAGE_KEYS.user, sessionUser]]);

        const loadedWage = parseWage(map[STORAGE_KEYS.wage] ?? '');
        setWage(loadedWage);
        setScreen(loadedWage === null ? 'wage' : 'main');
      } catch {
        setScreen('auth');
      }
    })();
  }, []);

  /** After sign-in: go to the tracker if a wage is already set. */
  const enterAs = useCallback(
    (u: User): void => {
      setUser(u);
      setScreen(wage === null ? 'wage' : 'main');
      save([[STORAGE_KEYS.user, u]]);
    },
    [wage],
  );

  const handleSocial = useCallback(
    async (provider: 'apple' | 'google'): Promise<void> => {
      setBusy(true);
      try {
        enterAs(await (provider === 'apple' ? signInWithApple() : signInWithGoogle()));
      } catch (e) {
        const msg = e instanceof AuthError ? e.message : 'Sign-in failed. Please try again.';
        if (msg !== 'Sign-in cancelled.') Alert.alert('Sign-in', msg);
      } finally {
        setBusy(false);
      }
    },
    [enterAs],
  );

  /** Wrap an async auth call with busy state + friendly error alerts. */
  const runAuth = useCallback(
    async (fn: () => Promise<User>): Promise<void> => {
      setBusy(true);
      try {
        enterAs(await fn());
      } catch (e) {
        const msg = e instanceof AuthError ? e.message : 'Something went wrong. Please try again.';
        Alert.alert('Account', msg);
      } finally {
        setBusy(false);
      }
    },
    [enterAs],
  );

  const handleEmailSignUp = useCallback(
    (username: string, email: string, password: string, confirm: string): void =>
      void runAuth(() => signUpWithEmail(username, email, password, confirm)),
    [runAuth],
  );

  const handleEmailLogin = useCallback(
    (email: string, password: string): void =>
      void runAuth(() => signInWithEmail(email, password)),
    [runAuth],
  );

  /** Guest mode: fully local, no server account (can sign up later). */
  const handleGuest = useCallback(
    (): void => enterAs(makeUser('guest', 'guest@bloop.local', 'local')),
    [enterAs],
  );

  const handleSaveWage = useCallback((value: number, currencySymbol: string): void => {
    setCurrency(currencySymbol);
    setWage(value);
    setScreen('main');
    save([
      [STORAGE_KEYS.wage, String(value)],
      [STORAGE_KEYS.currency, currencySymbol],
    ]);
  }, []);

  const handleFinishSession = useCallback(
    (result: SessionResult): void => {
      const nextStats = addSession(stats, result);
      const nextDaily = addToDaily(daily, result);
      setStats(nextStats);
      setDaily(nextDaily);
      syncMyStats(nextStats); // fire-and-forget: updates the friends leaderboard
      save([
        [STORAGE_KEYS.stats, nextStats],
        [STORAGE_KEYS.daily, nextDaily],
      ]);
    },
    [stats, daily],
  );

  const handleWalletChange = useCallback((w: Wallet): void => {
    setWallet(w);
    save([[STORAGE_KEYS.wallet, w]]);
  }, []);

  const handleLogout = useCallback(async (): Promise<void> => {
    setUser(null);
    setScreen('auth');
    await authSignOut().catch(() => {});
    await AsyncStorage.removeItem(STORAGE_KEYS.user).catch(() => {});
  }, []);

  const handleDeleteAccount = useCallback(async (): Promise<void> => {
    setUser(null);
    setWage(null);
    setStats(emptyStats());
    setWallet(emptyWallet());
    setDaily(emptyDaily());
    setCurrency(CURRENCIES[0].symbol);
    setScreen('auth');
    await authSignOut().catch(() => {});
    // Wipe EVERY key we own (previously currency + blocked list survived).
    await AsyncStorage.removeMany([...ALL_STORAGE_KEYS]).catch(() => {});
  }, []);

  return (
    <View style={ui.root}>
      <StatusBar barStyle={isNight ? 'light-content' : 'dark-content'} />
      {screen === 'loading' && (
        <View style={[ui.flex, styles.center]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      {screen === 'auth' && (
        <AuthScreen
          onEmailSignUp={handleEmailSignUp}
          onEmailLogin={handleEmailLogin}
          onGuest={handleGuest}
          onSocial={handleSocial}
          busy={busy}
        />
      )}
      {screen === 'wage' && (
        <SafeAreaView style={ui.flex}>
          <WageForm
            title="Set your wage"
            subtitle="Enter it once — we’ll remember it every time you open bloop."
            submitLabel="Confirm ✅"
            onSubmit={handleSaveWage}
          />
        </SafeAreaView>
      )}
      {screen === 'main' && user && wage !== null && (
        <MainScreen
          user={user}
          hourlyWage={wage}
          stats={stats}
          wallet={wallet}
          daily={daily}
          onFinishSession={handleFinishSession}
          onSaveWage={handleSaveWage}
          onWalletChange={handleWalletChange}
          onDeleteAccount={handleDeleteAccount}
          onLogout={handleLogout}
        />
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Styles                                     */
/* -------------------------------------------------------------------------- */

const labelCapsOf = (COLORS: ThemeColors) => ({
  color: COLORS.subtle,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}) as const;

const makeStyles = (COLORS: ThemeColors) => {
  const STICKER = stickerOf(COLORS);
  const STICKER_SM = stickerSmOf(COLORS);
  return StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  white: { color: COLORS.white },
  mintBg: { backgroundColor: COLORS.mintBg },

  emoji: { fontSize: 44, textAlign: 'center', marginBottom: SPACING.sm },
  title: { fontSize: 40, fontWeight: '800', color: COLORS.ink, textAlign: 'center', letterSpacing: -1 },
  subtitle: {
    fontSize: 15,
    color: COLORS.subtle,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    lineHeight: 21,
    paddingHorizontal: SPACING.sm,
  },

  /* Auth */
  authScroll: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.lg },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.hairline,
    borderRadius: 14,
    padding: 4,
    marginBottom: SPACING.md,
  },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  modeTabActive: { backgroundColor: COLORS.primary, ...STICKER_SM, shadowOffset: { width: 2, height: 2 } },
  modeTabText: { fontSize: 15, fontWeight: '700', color: COLORS.subtle },
  modeTabTextActive: { color: COLORS.card },
  guestLink: { alignItems: 'center', paddingVertical: SPACING.md },
  guestLinkText: { fontSize: 14, fontWeight: '700', color: COLORS.subtle },
  inputCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...STICKER,
  },
  inputLabel: { ...labelCapsOf(COLORS), fontSize: 13, fontWeight: '600', marginBottom: SPACING.xs },
  textField: { fontSize: 22, fontWeight: '600', color: COLORS.ink, paddingVertical: SPACING.xs },
  fieldDivider: { height: 1, backgroundColor: COLORS.hairline, marginVertical: SPACING.md },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { fontSize: 34, fontWeight: '700', color: COLORS.primary },
  input: {
    flex: 1,
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.ink,
    marginLeft: SPACING.xs,
    padding: 0,
  },
  perHour: { fontSize: 18, fontWeight: '600', color: COLORS.subtle },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...STICKER,
  },
  primaryButtonText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  secondaryButton: { paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.xs },
  secondaryButtonText: { color: COLORS.subtle, fontSize: 16, fontWeight: '600' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.lg },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.hairline },
  dividerText: { marginHorizontal: SPACING.sm, color: COLORS.subtle, fontSize: 13 },

  socialButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  appleButton: { backgroundColor: COLORS.ink },
  googleButton: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.hairline },
  socialText: { fontSize: 17, fontWeight: '600', color: COLORS.ink },
  googleLogo: { color: '#4285F4', fontWeight: '800' },
  footnote: { textAlign: 'center', color: COLORS.subtle, fontSize: 12, marginTop: SPACING.md },
  authSpinner: { marginTop: SPACING.md },

  /* Wage form */
  wageFormBody: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, justifyContent: 'center' },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  currencyPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.card,
  },
  currencyPillActive: { backgroundColor: COLORS.primary },
  currencyPillText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },

  /* Tracker */
  trackerContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  menuButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 26, color: COLORS.ink },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.ink, letterSpacing: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendsButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...STICKER_SM,
  },
  friendsButtonText: { fontSize: 14, fontWeight: '800', color: COLORS.card },
  greeting: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.subtle,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  wageStatsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  wageStatCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    ...STICKER_SM,
  },
  wageStatLabel: { ...labelCapsOf(COLORS), fontSize: 11, marginBottom: 4 },
  wageStatValue: { fontSize: 18, fontWeight: '800', color: COLORS.ink, fontVariant: ['tabular-nums'] },
  wageStatUnit: { fontSize: 12, fontWeight: '600', color: COLORS.subtle },

  animationWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  lottie: { width: 220, height: 220 },

  counterCard: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...STICKER,
    shadowOffset: { width: 6, height: 6 },
  },
  timerLabel: { fontSize: 13, color: COLORS.subtle, marginBottom: SPACING.xs },
  timer: {
    fontSize: 54,
    fontWeight: '800',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  earnedLabel: { ...labelCapsOf(COLORS), fontSize: 13, marginTop: SPACING.md },
  earnedValue: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.mint,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  bigButton: {
    borderRadius: 22,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    ...STICKER,
    shadowOffset: { width: 5, height: 5 },
  },
  startButton: { backgroundColor: COLORS.primary },
  finishButton: { backgroundColor: COLORS.accent },
  bigButtonText: { color: COLORS.white, fontSize: 20, fontWeight: '800' },

  adBanner: {
    marginTop: SPACING.md,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  adBannerText: { color: COLORS.subtle, fontSize: 13, fontWeight: '600' },

  /* Summary modal */
  modalBackdrop: { flex: 1, backgroundColor: COLORS.backdrop, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.ink,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl + SPACING.md,
    alignItems: 'center',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.hairline,
    marginBottom: SPACING.lg,
  },
  modalEmoji: { fontSize: 48 },
  modalTitle: { fontSize: 26, fontWeight: '800', color: COLORS.ink, marginTop: SPACING.sm },
  modalSubtitle: { fontSize: 15, color: COLORS.subtle, marginTop: 4 },
  statsRow: { flexDirection: 'row', width: '100%', marginVertical: SPACING.lg, gap: SPACING.md },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  statLabel: { ...labelCapsOf(COLORS), fontSize: 12, marginBottom: SPACING.xs },
  statValue: { fontSize: 30, fontWeight: '800', color: COLORS.ink, fontVariant: ['tabular-nums'] },

  /* Edit wage modal */
  editBackdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  editCard: {
    backgroundColor: COLORS.background,
    borderRadius: 28,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    ...STICKER,
  },

  /* Drawer */
  // absoluteFillObject no longer exists in RN 0.86 — spreading it silently
  // produced no positioning, so the dim overlay never covered the screen.
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: COLORS.backdrop },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: COLORS.card,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  drawerContent: { padding: SPACING.lg },
  drawerHeader: { alignItems: 'center', marginBottom: SPACING.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  avatarText: { color: COLORS.white, fontSize: 26, fontWeight: '800' },
  drawerName: { fontSize: 20, fontWeight: '800', color: COLORS.ink },
  drawerEmail: { fontSize: 13, color: COLORS.subtle, marginTop: 2 },
  drawerSectionLabel: {
    ...labelCapsOf(COLORS),
    fontSize: 12,
    fontWeight: '700',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  drawerStatsRow: { flexDirection: 'row', gap: SPACING.sm },
  drawerStatBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  drawerStatValue: { fontSize: 20, fontWeight: '800', color: COLORS.ink, fontVariant: ['tabular-nums'] },
  drawerStatUnit: { fontSize: 12, color: COLORS.subtle, marginTop: 2 },
  drawerHint: { fontSize: 12, color: COLORS.subtle, marginTop: SPACING.sm, textAlign: 'center' },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  drawerRowIcon: { fontSize: 18, marginRight: SPACING.sm, width: 24, textAlign: 'center' },
  drawerRowText: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  drawerSubtle: { fontSize: 12, color: COLORS.subtle, marginTop: 4 },
  drawerChevron: { fontSize: 22, color: COLORS.subtle },
  });
};

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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';

import SurveysScreen from './src/SurveysScreen';
import StatsScreen from './src/StatsScreen';
import FriendsScreen from './src/FriendsScreen';
import { syncMyStats } from './src/friends';
import { SOCIAL_LOGIN_ENABLED } from './src/config';
import {
  signInWithApple,
  signInWithGoogle,
  signOut as authSignOut,
  getCurrentUser,
  AuthError,
} from './src/auth';
import {
  CURRENCY,
  CURRENCIES,
  setCurrency,
  STORAGE_KEYS,
  WITHDRAW_THRESHOLD,
  earningsFor,
  addSession,
  formatTime,
  formatMoney,
  totalMinutes,
  parseWage,
  isValidEmail,
  isValidName,
  makeUser,
  emptyStats,
  emptyWallet,
  emptyDaily,
  addToDaily,
  type DailyStore,
  withdrawProgress,
  parseJSON,
  type User,
  type LifetimeStats,
  type Wallet,
  type SessionResult,
  type AuthProvider,
} from './src/core';

/* -------------------------------------------------------------------------- */
/*                                   Theme                                     */
/* -------------------------------------------------------------------------- */

// BLOOP brand (matches the Instagram sticker identity):
// cream background, bold orange, thick ink outlines, teal for money.
const COLORS = {
  background: '#FDF3E3',
  card: '#FFFDF8',
  primary: '#F4772E',
  primaryDark: '#E05F16',
  accent: '#2BBFA4',
  mint: '#1D9E82',
  mintBg: '#DFF5EF',
  sunshine: '#FFD166',
  ink: '#1B1511',
  subtle: '#8A7B6D',
  danger: '#E24B4A',
  dangerBg: '#FCEBEB',
  hairline: '#F0E4D0',
  black: '#1B1511',
  google: '#FFFDF8',
  googleText: '#1B1511',
} as const;

/** Sticker-style hard shadow + thick outline, shared across cards/buttons. */
const STICKER = {
  borderWidth: 3,
  borderColor: '#1B1511',
  shadowColor: '#1B1511',
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
} as const;

const SPACING = { xs: 6, sm: 12, md: 16, lg: 24, xl: 32 } as const;

const LOTTIE_URL =
  'https://lottie.host/4db68bbd-31f6-4cd8-84c2-8dcbe5c0b657/eBiVsBfaS4.json';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.82);

type AppScreen = 'loading' | 'auth' | 'wage' | 'main';

/* -------------------------------------------------------------------------- */
/*                              Haptics helpers                               */
/* -------------------------------------------------------------------------- */

const tapLight = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
const tapHeavy = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
};
const celebrate = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
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
  duration: number;
  size: number;
}

const makeConfetti = (count: number): ConfettiPiece[] =>
  Array.from({ length: count }, (_, i) => ({
    emoji: CONFETTI_PIECES[i % CONFETTI_PIECES.length],
    x: Math.random() * (SCREEN_WIDTH - 40),
    delay: Math.random() * 400,
    duration: 1200 + Math.random() * 800,
    size: 18 + Math.random() * 14,
  }));

const Confetti: React.FC<{ burstKey: number }> = ({ burstKey }) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (burstKey === 0) return;
    setPieces(makeConfetti(18));
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: true,
    }).start(() => setPieces([]));
  }, [burstKey, anim]);

  if (pieces.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-60, 640 + p.delay],
        });
        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', i % 2 === 0 ? '360deg' : '-360deg'],
        });
        const opacity = anim.interpolate({
          inputRange: [0, 0.75, 1],
          outputRange: [1, 1, 0],
        });
        return (
          <Animated.Text
            key={`${burstKey}-${i}`}
            style={{
              position: 'absolute',
              top: 0,
              left: p.x,
              fontSize: p.size,
              opacity,
              transform: [{ translateY }, { rotate }],
            }}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                          Social auth placeholders                          */
/* -------------------------------------------------------------------------- */

interface SocialButtonsProps {
  onApple: () => void;
  onGoogle: () => void;
  busy: boolean;
}

const SocialButtons: React.FC<SocialButtonsProps> = ({
  onApple,
  onGoogle,
  busy,
}) => (
  <View>
    <TouchableOpacity
      style={[styles.socialButton, styles.appleButton]}
      activeOpacity={0.85}
      disabled={busy}
      onPress={onApple}
    >
      <Text style={styles.appleLogo}></Text>
      <Text style={styles.appleButtonText}>Continue with Apple</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.socialButton, styles.googleButton]}
      activeOpacity={0.85}
      disabled={busy}
      onPress={onGoogle}
    >
      <Text style={styles.googleLogo}>G</Text>
      <Text style={styles.googleButtonText}>Continue with Google</Text>
    </TouchableOpacity>
  </View>
);

/* -------------------------------------------------------------------------- */
/*                                Auth screen                                 */
/* -------------------------------------------------------------------------- */

interface AuthProps {
  onSignUp: (name: string, email: string, provider: AuthProvider) => void;
  onApple: () => void;
  onGoogle: () => void;
  busy: boolean;
}

const AuthScreen: React.FC<AuthProps> = ({
  onSignUp,
  onApple,
  onGoogle,
  busy,
}) => {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  const handleSubmit = useCallback((): void => {
    if (!isValidName(name)) {
      Alert.alert('Oops!', 'Please enter your name.');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Oops!', 'Please enter a valid email.');
      return;
    }
    onSignUp(name, email, 'local');
  }, [name, email, onSignUp]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.authScroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.emoji}>🚽💸</Text>
          <Text style={styles.title}>bloop</Text>
          <Text style={styles.subtitle}>
            Get paid to go. Create your account to start tracking every break.
          </Text>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textField}
              value={name}
              onChangeText={setName}
              placeholder="Li"
              placeholderTextColor={COLORS.subtle}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <View style={styles.fieldDivider} />
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textField}
              value={email}
              onChangeText={setEmail}
              placeholder="name@email.com"
              placeholderTextColor={COLORS.subtle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={handleSubmit}
          >
            <Text style={styles.primaryButtonText}>Create account 🎉</Text>
          </TouchableOpacity>

          {SOCIAL_LOGIN_ENABLED && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>
              <SocialButtons onApple={onApple} onGoogle={onGoogle} busy={busy} />
            </>
          )}

          {busy && (
            <ActivityIndicator
              style={styles.authSpinner}
              color={COLORS.primary}
            />
          )}

          <Text style={styles.footnote}>
            {SOCIAL_LOGIN_ENABLED
              ? 'Apple & Google sign-in sync your account across devices.'
              : 'Your data is stored locally on your device.'}
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
  const [wage, setWage] = useState<string>(initialValue);
  const [symbol, setSymbol] = useState<string>(CURRENCY);

  const handleSubmit = useCallback((): void => {
    const parsed = parseWage(wage);
    if (parsed === null) {
      Alert.alert('Oops!', 'Please enter a valid hourly wage.');
      return;
    }
    onSubmit(parsed, symbol);
  }, [wage, symbol, onSubmit]);

  return (
    <View style={styles.wageFormBody}>
      <Text style={styles.emoji}>💰</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.currencyRow}>
        {CURRENCIES.map((c) => (
          <TouchableOpacity
            key={c.code}
            style={[
              styles.currencyPill,
              symbol === c.symbol && styles.currencyPillActive,
            ]}
            accessibilityLabel={`Use ${c.name}`}
            onPress={() => setSymbol(c.symbol)}
          >
            <Text
              style={[
                styles.currencyPillText,
                symbol === c.symbol && styles.currencyPillTextActive,
              ]}
            >
              {c.symbol} {c.code}
            </Text>
          </TouchableOpacity>
        ))}
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

      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={0.85}
        onPress={handleSubmit}
      >
        <Text style={styles.primaryButtonText}>{submitLabel}</Text>
      </TouchableOpacity>

      {onCancel && (
        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.7}
          onPress={onCancel}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                           Ad banner placeholder                            */
/* -------------------------------------------------------------------------- */

// Placeholder slot for a future ad (e.g. react-native-google-mobile-ads).
// Keeping the layout space reserved now avoids reflow when ads are wired in.
const AdBanner: React.FC = () => (
  <View style={styles.adBanner}>
    <Text style={styles.adBannerText}>Ad space · coming soon</Text>
  </View>
);

/* -------------------------------------------------------------------------- */
/*                              Session summary                               */
/* -------------------------------------------------------------------------- */

interface SummaryProps {
  visible: boolean;
  result: SessionResult | null;
  onClose: () => void;
}

const SummaryModal: React.FC<SummaryProps> = ({ visible, result, onClose }) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    presentationStyle="overFullScreen"
    onRequestClose={onClose}
  >
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <View style={styles.grabber} />
        <Text style={styles.modalEmoji}>🎉</Text>
        <Text style={styles.modalTitle}>Break complete!</Text>
        <Text style={styles.modalSubtitle}>Here’s how you did.</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>
              {result ? formatTime(result.elapsedSeconds) : '00:00'}
            </Text>
          </View>
          <View style={[styles.statBox, styles.statBoxAccent]}>
            <Text style={styles.statLabel}>Earned</Text>
            <Text style={[styles.statValue, styles.statValueAccent]}>
              {CURRENCY}
              {result ? formatMoney(result.amountEarned) : '0.00'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={onClose}
        >
          <Text style={styles.primaryButtonText}>Nice! Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

/* -------------------------------------------------------------------------- */
/*                                  Drawer                                     */
/* -------------------------------------------------------------------------- */

interface DrawerProps {
  open: boolean;
  user: User;
  stats: LifetimeStats;
  wallet: Wallet;
  onClose: () => void;
  onEditWage: () => void;
  onSurveys: () => void;
  onStats: () => void;
  onFriends: () => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
}

const Drawer: React.FC<DrawerProps> = ({
  open,
  user,
  stats,
  wallet,
  onClose,
  onEditWage,
  onSurveys,
  onStats,
  onFriends,
  onDeleteAccount,
  onLogout,
}) => {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState<boolean>(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : -DRAWER_WIDTH,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(overlay, {
        toValue: open ? 1 : 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(({ finished }: { finished: boolean }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, translateX, overlay]);

  if (!mounted) return null;

  const initials = user.name.trim().slice(0, 1).toUpperCase() || 'U';
  const progress = withdrawProgress(wallet);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.overlay, { opacity: overlay }]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.drawerContent}>
            <View style={styles.drawerHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.drawerName}>{user.name}</Text>
              <Text style={styles.drawerEmail}>{user.email}</Text>
            </View>

            <Text style={styles.drawerSectionLabel}>Lifetime</Text>
            <View style={styles.drawerStatsRow}>
              <View style={styles.drawerStatBox}>
                <Text style={styles.drawerStatValue}>
                  {totalMinutes(stats.totalSeconds)}
                </Text>
                <Text style={styles.drawerStatUnit}>minutes</Text>
              </View>
              <View style={[styles.drawerStatBox, styles.drawerStatBoxMint]}>
                <Text style={[styles.drawerStatValue, styles.mintText]}>
                  {CURRENCY}
                  {formatMoney(stats.totalEarned)}
                </Text>
                <Text style={styles.drawerStatUnit}>earned</Text>
              </View>
            </View>
            <Text style={styles.drawerHint}>
              {stats.sessions} session{stats.sessions === 1 ? '' : 's'} logged
            </Text>

            <Text style={styles.drawerSectionLabel}>Account</Text>
            <TouchableOpacity style={styles.drawerRow} onPress={onStats}>
              <Text style={styles.drawerRowIcon}>📈</Text>
              <Text style={styles.drawerRowText}>My stats</Text>
              <Text style={styles.drawerChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.drawerRow} onPress={onFriends}>
              <Text style={styles.drawerRowIcon}>👥</Text>
              <Text style={styles.drawerRowText}>Friends &amp; leaderboard</Text>
              <Text style={styles.drawerChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.drawerRow} onPress={onEditWage}>
              <Text style={styles.drawerRowIcon}>✏️</Text>
              <Text style={styles.drawerRowText}>Edit hourly wage</Text>
              <Text style={styles.drawerChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.drawerRowDisabled} onPress={onSurveys}>
              <Text style={styles.drawerRowIcon}>📝</Text>
              <View style={styles.flex}>
                <Text style={styles.drawerRowText}>Surveys &amp; rewards</Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${progress * 100}%` }]}
                  />
                </View>
                <Text style={styles.drawerSubtle}>
                  {CURRENCY}
                  {formatMoney(wallet.balance)} / {CURRENCY}
                  {WITHDRAW_THRESHOLD} to withdraw
                </Text>
              </View>
              <Text style={styles.drawerChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.drawerRow} onPress={onLogout}>
              <Text style={styles.drawerRowIcon}>🚪</Text>
              <Text style={styles.drawerRowText}>Log out</Text>
              <Text style={styles.drawerChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.drawerRow}
              onPress={onDeleteAccount}
            >
              <Text style={styles.drawerRowIcon}>🗑️</Text>
              <Text style={[styles.drawerRowText, styles.dangerText]}>
                Delete account
              </Text>
              <Text style={[styles.drawerChevron, styles.dangerText]}>›</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
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
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [summary, setSummary] = useState<SessionResult | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [editWage, setEditWage] = useState<boolean>(false);
  const [showSurveys, setShowSurveys] = useState<boolean>(false);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [showFriends, setShowFriends] = useState<boolean>(false);
  const [confettiKey, setConfettiKey] = useState<number>(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRunning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
    return undefined;
  }, [isRunning, pulse]);

  const clearTimer = useCallback((): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const handleStart = useCallback((): void => {
    tapHeavy();
    setElapsed(0);
    startRef.current = Date.now();
    setIsRunning(true);
    clearTimer();
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
  }, [clearTimer]);

  const handleFinish = useCallback((): void => {
    clearTimer();
    celebrate();
    const finalSeconds = Math.floor((Date.now() - startRef.current) / 1000);
    setIsRunning(false);
    setElapsed(finalSeconds);
    const result: SessionResult = {
      elapsedSeconds: finalSeconds,
      amountEarned: earningsFor(finalSeconds, hourlyWage),
    };
    setSummary(result);
    setShowSummary(true);
    setConfettiKey((k) => k + 1);
    onFinishSession(result);
  }, [clearTimer, hourlyWage, onFinishSession]);

  const handleCloseSummary = useCallback((): void => {
    setShowSummary(false);
    setElapsed(0);
  }, []);

  const confirmDelete = useCallback((): void => {
    setDrawerOpen(false);
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile, wage, and lifetime stats on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDeleteAccount },
      ],
    );
  }, [onDeleteAccount]);

  const liveEarnings = earningsFor(elapsed, hourlyWage);

  return (
    <View style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.trackerContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.menuButton}
              activeOpacity={0.7}
              onPress={() => {
                tapLight();
                setDrawerOpen(true);
              }}
            >
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>bloop</Text>
            <View style={styles.menuButton} />
          </View>

          <View style={styles.wageStatsRow}>
            <View style={styles.wageStatCard}>
              <Text style={styles.wageStatLabel}>Hourly wage</Text>
              <Text style={styles.wageStatValue}>
                {CURRENCY}
                {formatMoney(hourlyWage)}
              </Text>
            </View>
            <View style={styles.wageStatCard}>
              <Text style={styles.wageStatLabel}>Total time</Text>
              <Text style={styles.wageStatValue}>
                {totalMinutes(stats.totalSeconds)}
                <Text style={styles.wageStatUnit}> min</Text>
              </Text>
            </View>
            <View style={[styles.wageStatCard, styles.wageStatCardMint]}>
              <Text style={styles.wageStatLabel}>Total earned</Text>
              <Text style={[styles.wageStatValue, styles.mintText]}>
                {CURRENCY}
                {formatMoney(stats.totalEarned)}
              </Text>
            </View>
          </View>

          <View style={styles.animationWrap}>
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <LottieView
                source={{ uri: LOTTIE_URL }}
                autoPlay
                loop={isRunning}
                speed={isRunning ? 1 : 0}
                style={styles.lottie}
              />
            </Animated.View>
          </View>

          <View style={styles.counterCard}>
            <Text style={styles.timerLabel}>
              {isRunning ? 'Session in progress' : 'Ready when you are'}
            </Text>
            <Text style={styles.timer}>{formatTime(elapsed)}</Text>
            <Text style={styles.earnedLabel}>You earned</Text>
            <Text style={styles.earnedValue}>
              {CURRENCY}
              {formatMoney(liveEarnings)}
            </Text>
          </View>

          {isRunning ? (
            <TouchableOpacity
              style={[styles.bigButton, styles.finishButton]}
              activeOpacity={0.85}
              onPress={handleFinish}
            >
              <Text style={styles.bigButtonText}>Finish 🏁</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.bigButton, styles.startButton]}
              activeOpacity={0.85}
              onPress={handleStart}
            >
              <Text style={styles.bigButtonText}>Start Session 🚀</Text>
            </TouchableOpacity>
          )}

          <AdBanner />
        </View>
      </SafeAreaView>

      <SummaryModal
        visible={showSummary}
        result={summary}
        onClose={handleCloseSummary}
      />

      <Modal
        visible={editWage}
        transparent
        animationType="fade"
        onRequestClose={() => setEditWage(false)}
      >
        <View style={styles.editBackdrop}>
          <View style={styles.editCard}>
            <WageForm
              title="Edit wage"
              subtitle="Update your hourly rate. It’s saved for next time."
              submitLabel="Save 💾"
              initialValue={String(hourlyWage)}
              onSubmit={(w, c) => {
                onSaveWage(w, c);
                setEditWage(false);
              }}
              onCancel={() => setEditWage(false)}
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
        onEditWage={() => {
          setDrawerOpen(false);
          setEditWage(true);
        }}
        onSurveys={() => {
          tapLight();
          setDrawerOpen(false);
          setShowSurveys(true);
        }}
        onStats={() => {
          tapLight();
          setDrawerOpen(false);
          setShowStats(true);
        }}
        onFriends={() => {
          tapLight();
          setDrawerOpen(false);
          setShowFriends(true);
        }}
        onDeleteAccount={confirmDelete}
        onLogout={() => {
          setDrawerOpen(false);
          onLogout();
        }}
      />

      <SurveysScreen
        visible={showSurveys}
        wallet={wallet}
        onWalletChange={onWalletChange}
        onClose={() => setShowSurveys(false)}
      />

      <StatsScreen
        visible={showStats}
        stats={stats}
        daily={daily}
        onClose={() => setShowStats(false)}
      />

      <FriendsScreen
        visible={showFriends}
        stats={stats}
        onClose={() => setShowFriends(false)}
      />

      <Confetti burstKey={confettiKey} />
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                   App                                       */
/* -------------------------------------------------------------------------- */

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [wage, setWage] = useState<number | null>(null);
  const [stats, setStats] = useState<LifetimeStats>(emptyStats());
  const [wallet, setWallet] = useState<Wallet>(emptyWallet());
  const [daily, setDaily] = useState<DailyStore>(emptyDaily());
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    (async (): Promise<void> => {
      try {
        const entries = await AsyncStorage.multiGet([
          STORAGE_KEYS.user,
          STORAGE_KEYS.wage,
          STORAGE_KEYS.stats,
          STORAGE_KEYS.wallet,
          STORAGE_KEYS.daily,
          STORAGE_KEYS.currency,
        ]);
        const map = Object.fromEntries(entries) as Record<string, string | null>;

        const storedCurrency = map[STORAGE_KEYS.currency];
        if (storedCurrency) setCurrency(storedCurrency);

        const loadedWage = map[STORAGE_KEYS.wage]
          ? parseFloat(map[STORAGE_KEYS.wage] as string)
          : null;
        setStats(parseJSON<LifetimeStats>(map[STORAGE_KEYS.stats], emptyStats()));
        setWallet(parseJSON<Wallet>(map[STORAGE_KEYS.wallet], emptyWallet()));
        setDaily(parseJSON<DailyStore>(map[STORAGE_KEYS.daily], emptyDaily()));

        // Prefer a live server session (Apple/Google); fall back to local user.
        const sessionUser = await getCurrentUser();
        const localUser = parseJSON<User | null>(map[STORAGE_KEYS.user], null);
        const loadedUser = sessionUser ?? localUser;

        if (!loadedUser) {
          setScreen('auth');
        } else {
          setUser(loadedUser);
          if (sessionUser) {
            await AsyncStorage.setItem(
              STORAGE_KEYS.user,
              JSON.stringify(sessionUser),
            );
          }
          if (loadedWage && loadedWage > 0) {
            setWage(loadedWage);
            setScreen('main');
          } else {
            setScreen('wage');
          }
        }
      } catch {
        setScreen('auth');
      }
    })();
  }, []);

  const handleSocial = useCallback(
    async (provider: 'apple' | 'google'): Promise<void> => {
      setBusy(true);
      try {
        const signedIn =
          provider === 'apple'
            ? await signInWithApple()
            : await signInWithGoogle();
        setUser(signedIn);
        setScreen(wage && wage > 0 ? 'main' : 'wage');
        await AsyncStorage.setItem(
          STORAGE_KEYS.user,
          JSON.stringify(signedIn),
        );
      } catch (e) {
        const msg =
          e instanceof AuthError
            ? e.message
            : 'Sign-in failed. Please try again.';
        if (msg !== 'Sign-in cancelled.') {
          Alert.alert('Sign-in', msg);
        }
      } finally {
        setBusy(false);
      }
    },
    [wage],
  );

  const handleSignUp = useCallback(
    async (name: string, email: string, provider: AuthProvider): Promise<void> => {
      const newUser = makeUser(name, email, provider);
      setUser(newUser);
      setScreen(wage && wage > 0 ? 'main' : 'wage');
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(newUser));
      } catch {
        /* non-fatal */
      }
    },
    [wage],
  );

  const handleSaveWage = useCallback(
    async (value: number, currencySymbol: string): Promise<void> => {
      setCurrency(currencySymbol);
      setWage(value);
      setScreen('main');
      try {
        await AsyncStorage.multiSet([
          [STORAGE_KEYS.wage, String(value)],
          [STORAGE_KEYS.currency, currencySymbol],
        ]);
      } catch {
        /* non-fatal */
      }
    },
    [],
  );

  const handleFinishSession = useCallback(
    async (result: SessionResult): Promise<void> => {
      const next = addSession(stats, result);
      const nextDaily = addToDaily(daily, result);
      setStats(next);
      setDaily(nextDaily);
      syncMyStats(next); // fire-and-forget: updates the friends leaderboard
      try {
        await AsyncStorage.multiSet([
          [STORAGE_KEYS.stats, JSON.stringify(next)],
          [STORAGE_KEYS.daily, JSON.stringify(nextDaily)],
        ]);
      } catch {
        /* non-fatal */
      }
    },
    [stats, daily],
  );

  const handleWalletChange = useCallback(async (w: Wallet): Promise<void> => {
    setWallet(w);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.wallet, JSON.stringify(w));
    } catch {
      /* non-fatal */
    }
  }, []);

  const handleDeleteAccount = useCallback(async (): Promise<void> => {
    setUser(null);
    setWage(null);
    setStats(emptyStats());
    setWallet(emptyWallet());
    setDaily(emptyDaily());
    setScreen('auth');
    try {
      await authSignOut();
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.user,
        STORAGE_KEYS.wage,
        STORAGE_KEYS.stats,
        STORAGE_KEYS.wallet,
        STORAGE_KEYS.daily,
      ]);
    } catch {
      /* non-fatal */
    }
  }, []);

  const handleLogout = useCallback(async (): Promise<void> => {
    setUser(null);
    setScreen('auth');
    try {
      await authSignOut();
      await AsyncStorage.removeItem(STORAGE_KEYS.user);
    } catch {
      /* non-fatal */
    }
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      {screen === 'loading' && (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
      {screen === 'auth' && (
        <AuthScreen
          onSignUp={handleSignUp}
          onApple={() => handleSocial('apple')}
          onGoogle={() => handleSocial('google')}
          busy={busy}
        />
      )}
      {screen === 'wage' && (
        <SafeAreaView style={styles.flex}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  emoji: { fontSize: 44, textAlign: 'center', marginBottom: SPACING.sm },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    letterSpacing: -1,
  },
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
  authScroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  inputCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...STICKER,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  textField: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.ink,
    paddingVertical: SPACING.xs,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: COLORS.hairline,
    marginVertical: SPACING.md,
  },
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
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  secondaryButton: { paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.xs },
  secondaryButtonText: { color: COLORS.subtle, fontSize: 16, fontWeight: '600' },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.hairline },
  dividerText: { marginHorizontal: SPACING.sm, color: COLORS.subtle, fontSize: 13 },

  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  appleButton: { backgroundColor: COLORS.black },
  appleLogo: { color: '#FFFFFF', fontSize: 18, marginRight: SPACING.xs, marginTop: -2 },
  appleButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  googleButton: { backgroundColor: COLORS.google, borderWidth: 1, borderColor: COLORS.hairline },
  googleLogo: {
    color: '#4285F4',
    fontSize: 18,
    fontWeight: '800',
    marginRight: SPACING.xs,
  },
  googleButtonText: { color: COLORS.googleText, fontSize: 17, fontWeight: '600' },
  footnote: {
    textAlign: 'center',
    color: COLORS.subtle,
    fontSize: 12,
    marginTop: SPACING.md,
  },
  authSpinner: { marginTop: SPACING.md },

  /* Wage form */
  wageFormBody: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    justifyContent: 'center',
  },
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
  currencyPillTextActive: { color: '#FFFDF8' },

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
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.5,
  },

  wageStatsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  wageStatCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    ...STICKER,
    borderWidth: 2.5,
    shadowOffset: { width: 3, height: 3 },
  },
  wageStatCardMint: { backgroundColor: COLORS.mintBg },
  wageStatLabel: {
    fontSize: 11,
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  wageStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  wageStatUnit: { fontSize: 12, fontWeight: '600', color: COLORS.subtle },
  mintText: { color: COLORS.mint },

  animationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  lottie: { width: 220, height: 220 },

  counterCard: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
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
  earnedLabel: {
    fontSize: 13,
    color: COLORS.subtle,
    marginTop: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
  bigButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },

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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 46, 0.45)',
    justifyContent: 'flex-end',
  },
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
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  statBoxAccent: { backgroundColor: COLORS.mintBg },
  statLabel: {
    fontSize: 12,
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  statValueAccent: { color: COLORS.mint },

  /* Edit wage modal */
  editBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 46, 0.45)',
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 27, 46, 0.45)',
  },
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
  avatarText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  drawerName: { fontSize: 20, fontWeight: '800', color: COLORS.ink },
  drawerEmail: { fontSize: 13, color: COLORS.subtle, marginTop: 2 },

  drawerSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  drawerStatBoxMint: { backgroundColor: COLORS.mintBg },
  drawerStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  drawerStatUnit: { fontSize: 12, color: COLORS.subtle, marginTop: 2 },
  drawerHint: { fontSize: 12, color: COLORS.subtle, marginTop: SPACING.sm, textAlign: 'center' },

  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  drawerRowDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  drawerRowIcon: { fontSize: 18, marginRight: SPACING.sm, width: 24, textAlign: 'center' },
  drawerRowText: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  drawerSubtle: { fontSize: 12, color: COLORS.subtle, marginTop: 4 },
  drawerChevron: { fontSize: 22, color: COLORS.subtle },
  dangerText: { color: COLORS.danger },
  soonBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark,
    backgroundColor: COLORS.hairline,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.hairline,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: COLORS.mint },
});

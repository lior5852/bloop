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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';

/* -------------------------------------------------------------------------- */
/*                                   Theme                                     */
/* -------------------------------------------------------------------------- */

const COLORS = {
  background: '#FFF7FB',
  card: '#FFFFFF',
  primary: '#7C4DFF', // vibrant purple
  primaryDark: '#5E35D6',
  accent: '#FF5FA2', // neon pink
  mint: '#3DDC97', // mint green
  sunshine: '#FFD166', // pastel yellow
  ink: '#1E1B2E',
  subtle: '#8A85A3',
  danger: '#FF5A5F',
  hairline: '#EFEAF6',
  black: '#000000',
} as const;

const SPACING = {
  xs: 6,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

const CURRENCY = '₪';

/* -------------------------------------------------------------------------- */
/*                                   Types                                     */
/* -------------------------------------------------------------------------- */

interface SessionResult {
  elapsedSeconds: number;
  amountEarned: number;
}

type AppScreen = 'loading' | 'setup' | 'tracker';

const STORAGE_KEY = '@bloop:hourlyWage';

// A cute, remote Lottie animation (coins / money vibe) so no local asset is required.
const LOTTIE_URL =
  'https://lottie.host/4db68bbd-31f6-4cd8-84c2-8dcbe5c0b657/eBiVsBfaS4.json';

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                    */
/* -------------------------------------------------------------------------- */

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}`;
};

const formatMoney = (amount: number): string =>
  amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const earningsFor = (elapsedSeconds: number, hourlyWage: number): number =>
  (hourlyWage / 3600) * elapsedSeconds;

/* -------------------------------------------------------------------------- */
/*                          Reusable: Apple Sign-in                            */
/* -------------------------------------------------------------------------- */

const AppleSignInButton: React.FC = () => (
  <TouchableOpacity
    style={styles.appleButton}
    activeOpacity={0.85}
    onPress={() =>
      Alert.alert('Coming soon', 'Sign in with Apple will be available soon.')
    }
  >
    <Text style={styles.appleLogo}></Text>
    <Text style={styles.appleButtonText}>Sign in with Apple</Text>
  </TouchableOpacity>
);

/* -------------------------------------------------------------------------- */
/*                              Profile Setup                                  */
/* -------------------------------------------------------------------------- */

interface SetupProps {
  onSave: (wage: number) => void;
}

const SetupScreen: React.FC<SetupProps> = ({ onSave }) => {
  const [wage, setWage] = useState<string>('');

  const handleSave = useCallback((): void => {
    const parsed = parseFloat(wage.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert('Oops!', 'Please enter a valid hourly wage.');
      return;
    }
    onSave(parsed);
  }, [wage, onSave]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.flex}>
        <View style={styles.setupContainer}>
          <View>
            <Text style={styles.emoji}>🚽💸</Text>
            <Text style={styles.title}>bloop</Text>
            <Text style={styles.subtitle}>
              Get paid to go. Track what you earn on every restroom break.
            </Text>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Your hourly wage</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currencyPrefix}>{CURRENCY}</Text>
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
                  onSubmitEditing={handleSave}
                />
                <Text style={styles.perHour}>/ hr</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={handleSave}
            >
              <Text style={styles.primaryButtonText}>Let’s go 🎉</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.setupFooter}>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>
            <AppleSignInButton />
            <Text style={styles.footnote}>
              Your wage is stored locally on your device.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

/* -------------------------------------------------------------------------- */
/*                              Session Summary                                */
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
/*                              Tracker Screen                                 */
/* -------------------------------------------------------------------------- */

interface TrackerProps {
  hourlyWage: number;
  onEditWage: () => void;
}

const TrackerScreen: React.FC<TrackerProps> = ({ hourlyWage, onEditWage }) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [summary, setSummary] = useState<SessionResult | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const clearTimer = useCallback((): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const handleStart = useCallback((): void => {
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
    const finalSeconds = Math.floor((Date.now() - startRef.current) / 1000);
    setIsRunning(false);
    setElapsed(finalSeconds);
    setSummary({
      elapsedSeconds: finalSeconds,
      amountEarned: earningsFor(finalSeconds, hourlyWage),
    });
    setShowSummary(true);
  }, [clearTimer, hourlyWage]);

  const handleCloseSummary = useCallback((): void => {
    setShowSummary(false);
    setElapsed(0);
  }, []);

  const liveEarnings = earningsFor(elapsed, hourlyWage);

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.trackerContainer}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>bloop</Text>
            <Text style={styles.headerSubtitle}>
              {CURRENCY}
              {formatMoney(hourlyWage)} / hr
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editChip}
            activeOpacity={0.8}
            onPress={onEditWage}
          >
            <Text style={styles.editChipText}>Edit wage</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.animationWrap}>
          <LottieView
            source={{ uri: LOTTIE_URL }}
            autoPlay
            loop={isRunning}
            speed={isRunning ? 1 : 0}
            style={styles.lottie}
          />
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
      </View>

      <SummaryModal
        visible={showSummary}
        result={summary}
        onClose={handleCloseSummary}
      />
    </SafeAreaView>
  );
};

/* -------------------------------------------------------------------------- */
/*                                   App                                       */
/* -------------------------------------------------------------------------- */

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [hourlyWage, setHourlyWage] = useState<number>(0);

  useEffect(() => {
    (async (): Promise<void> => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          const parsed = parseFloat(stored);
          if (!Number.isNaN(parsed) && parsed > 0) {
            setHourlyWage(parsed);
            setScreen('tracker');
            return;
          }
        }
        setScreen('setup');
      } catch {
        setScreen('setup');
      }
    })();
  }, []);

  const handleSaveWage = useCallback(async (wage: number): Promise<void> => {
    setHourlyWage(wage);
    setScreen('tracker');
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(wage));
    } catch {
      // Non-fatal: keep going with in-memory wage for this session.
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
      {screen === 'setup' && <SetupScreen onSave={handleSaveWage} />}
      {screen === 'tracker' && (
        <TrackerScreen
          hourlyWage={hourlyWage}
          onEditWage={() => setScreen('setup')}
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

  /* Setup */
  setupContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    justifyContent: 'space-between',
  },
  emoji: { fontSize: 44, textAlign: 'center', marginBottom: SPACING.sm },
  title: {
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.subtle,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    lineHeight: 22,
    paddingHorizontal: SPACING.sm,
  },
  inputCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
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
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  setupFooter: { paddingBottom: SPACING.md },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.hairline },
  dividerText: {
    marginHorizontal: SPACING.sm,
    color: COLORS.subtle,
    fontSize: 13,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.black,
    borderRadius: 14,
    paddingVertical: SPACING.md,
  },
  appleLogo: {
    color: '#FFFFFF',
    fontSize: 18,
    marginRight: SPACING.xs,
    marginTop: -2,
  },
  appleButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  footnote: {
    textAlign: 'center',
    color: COLORS.subtle,
    fontSize: 12,
    marginTop: SPACING.md,
  },

  /* Tracker */
  trackerContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  headerSubtitle: { fontSize: 14, color: COLORS.subtle, marginTop: 2 },
  editChip: {
    backgroundColor: COLORS.hairline,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 999,
  },
  editChipText: { color: COLORS.primaryDark, fontWeight: '600', fontSize: 13 },

  animationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  lottie: { width: 240, height: 240 },

  counterCard: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  timerLabel: { fontSize: 13, color: COLORS.subtle, marginBottom: SPACING.xs },
  timer: {
    fontSize: 56,
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
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.mint,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  bigButton: {
    borderRadius: 22,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  startButton: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary },
  finishButton: { backgroundColor: COLORS.accent, shadowColor: COLORS.accent },
  bigButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 46, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.card,
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
  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.ink,
    marginTop: SPACING.sm,
  },
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
  statBoxAccent: { backgroundColor: '#EAFBF3' },
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
});

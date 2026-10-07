/**
 * bloop — Surveys & rewards screen.
 *
 * Works in two modes:
 *  - DEMO (now): local sample surveys that credit the wallet after a short
 *    simulated completion, so the whole earn → threshold → withdraw flow is
 *    real and testable end-to-end.
 *  - PROVIDER (later): once you open a survey-provider account (BitLabs / CPX
 *    Research / Pollfish), set OFFERWALL_URL below and the screen renders the
 *    real offerwall in a WebView. Rewards then arrive via the provider's
 *    server-to-server callback to your backend (see AUTH_SETUP.md).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';

import {
  CURRENCY,
  WITHDRAW_THRESHOLD,
  formatMoney,
  canWithdraw,
  withdrawProgress,
  creditWallet,
  applyWithdrawal,
  DEMO_OFFERS,
  type Wallet,
  type SurveyOffer,
} from './core';

/**
 * Set this to your provider's offerwall URL (with your app id + user id) to
 * switch from demo surveys to real paying surveys. Requires:
 *   npx expo install react-native-webview
 * and a provider account. Until then, demo mode runs.
 */
export const OFFERWALL_URL: string | null = null;

const COLORS = {
  background: '#FDF3E3',
  card: '#FFFDF8',
  primary: '#F4772E',
  primaryDark: '#E05F16',
  mint: '#1D9E82',
  mintBg: '#DFF5EF',
  ink: '#1B1511',
  subtle: '#8A7B6D',
  hairline: '#F0E4D0',
  sunshine: '#FFD166',
} as const;

const STICKER = {
  borderWidth: 3,
  borderColor: '#1B1511',
  shadowColor: '#1B1511',
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
} as const;

interface Props {
  visible: boolean;
  wallet: Wallet;
  onWalletChange: (w: Wallet) => void;
  onClose: () => void;
}

const SurveysScreen: React.FC<Props> = ({
  visible,
  wallet,
  onWalletChange,
  onClose,
}) => {
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [doneOffers, setDoneOffers] = useState<readonly string[]>([]);

  const progress = withdrawProgress(wallet);

  const completeOffer = useCallback(
    (offer: SurveyOffer): void => {
      if (busyOffer !== null || doneOffers.includes(offer.id)) return;
      setBusyOffer(offer.id);
      // Simulated completion delay (real mode: provider callback credits you).
      setTimeout(() => {
        const next = creditWallet(wallet, offer.reward);
        onWalletChange(next);
        setDoneOffers((d) => [...d, offer.id]);
        setBusyOffer(null);
        Alert.alert(
          'Nice! 🎉',
          `${CURRENCY}${formatMoney(offer.reward)} added to your balance.`,
        );
      }, 1200);
    },
    [busyOffer, doneOffers, wallet, onWalletChange],
  );

  const handleWithdraw = useCallback((): void => {
    const after = applyWithdrawal(wallet);
    if (after === null) {
      Alert.alert(
        'Almost there',
        `You need ${CURRENCY}${formatMoney(
          WITHDRAW_THRESHOLD - wallet.balance,
        )} more to withdraw.`,
      );
      return;
    }
    Alert.alert(
      'Withdraw',
      `Payouts to Bit / bank open soon. Your ${CURRENCY}${WITHDRAW_THRESHOLD} stays safe in your balance until then.`,
    );
  }, [wallet]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Surveys &amp; rewards</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close surveys"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Your balance</Text>
            <Text style={styles.balanceValue}>
              {CURRENCY}
              {formatMoney(wallet.balance)}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
            <Text style={styles.progressHint}>
              {canWithdraw(wallet)
                ? 'You reached the withdrawal threshold! 🎉'
                : `${CURRENCY}${formatMoney(
                    WITHDRAW_THRESHOLD - wallet.balance,
                  )} to go until you can withdraw`}
            </Text>
            <TouchableOpacity
              style={[
                styles.withdrawButton,
                !canWithdraw(wallet) && styles.withdrawDisabled,
              ]}
              activeOpacity={0.85}
              onPress={handleWithdraw}
            >
              <Text style={styles.withdrawText}>
                Withdraw {CURRENCY}
                {WITHDRAW_THRESHOLD} 💸
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>
            {OFFERWALL_URL === null ? 'Try it out (demo surveys)' : 'Available surveys'}
          </Text>
          {OFFERWALL_URL === null && (
            <Text style={styles.demoNote}>
              These are practice surveys — real paying surveys arrive when the
              survey partner goes live.
            </Text>
          )}

          {DEMO_OFFERS.map((offer) => {
            const done = doneOffers.includes(offer.id);
            const busy = busyOffer === offer.id;
            return (
              <TouchableOpacity
                key={offer.id}
                style={[styles.offerCard, done && styles.offerDone]}
                activeOpacity={0.85}
                disabled={done || busy}
                onPress={() => completeOffer(offer)}
              >
                <Text style={styles.offerEmoji}>{offer.emoji}</Text>
                <View style={styles.offerBody}>
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  <Text style={styles.offerMeta}>~{offer.minutes} min</Text>
                </View>
                {busy ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <View style={[styles.rewardPill, done && styles.rewardDone]}>
                    <Text style={styles.rewardText}>
                      {done
                        ? '✓ Done'
                        : `+${CURRENCY}${formatMoney(offer.reward)}`}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
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
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },

  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    ...STICKER,
    shadowOffset: { width: 6, height: 6 },
  },
  balanceLabel: {
    fontSize: 12,
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.mint,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.hairline,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.mint,
  },
  progressHint: { fontSize: 13, color: COLORS.subtle, marginTop: 8 },
  withdrawButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    ...STICKER,
  },
  withdrawDisabled: { backgroundColor: COLORS.hairline },
  withdrawText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  demoNote: { fontSize: 13, color: COLORS.subtle, marginBottom: 12 },

  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...STICKER,
    borderWidth: 2.5,
    shadowOffset: { width: 3, height: 3 },
  },
  offerDone: { opacity: 0.6 },
  offerEmoji: { fontSize: 28, marginRight: 12 },
  offerBody: { flex: 1 },
  offerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  offerMeta: { fontSize: 13, color: COLORS.subtle, marginTop: 2 },
  rewardPill: {
    backgroundColor: COLORS.mintBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rewardDone: { backgroundColor: COLORS.hairline },
  rewardText: { fontSize: 14, fontWeight: '800', color: COLORS.mint },
});

export default SurveysScreen;

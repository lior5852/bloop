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
import React, { useState } from 'react';
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

import { SheetHeader, ProgressBar, useThemed, stickerOf, stickerSmOf, type ThemeColors } from './ui';
import {
  CURRENCY,
  WITHDRAW_THRESHOLD,
  money,
  canWithdraw,
  withdrawProgress,
  creditWallet,
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

interface Props {
  visible: boolean;
  wallet: Wallet;
  onWalletChange: (w: Wallet) => void;
  onClose: () => void;
}

const SurveysScreen: React.FC<Props> = ({ visible, wallet, onWalletChange, onClose }) => {
  const { styles, ui, colors: COLORS } = useThemed(makeStyles);
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [doneOffers, setDoneOffers] = useState<ReadonlySet<string>>(new Set());

  const withdrawable = canWithdraw(wallet);
  const missing = money(WITHDRAW_THRESHOLD - wallet.balance);

  const completeOffer = (offer: SurveyOffer): void => {
    if (busyOffer !== null || doneOffers.has(offer.id)) return;
    setBusyOffer(offer.id);
    // Simulated completion delay (real mode: provider callback credits you).
    setTimeout(() => {
      onWalletChange(creditWallet(wallet, offer.reward));
      setDoneOffers((d) => new Set(d).add(offer.id));
      setBusyOffer(null);
      Alert.alert('Nice! 🎉', `${money(offer.reward)} added to your balance.`);
    }, 1200);
  };

  const handleWithdraw = (): void =>
    withdrawable
      ? Alert.alert(
          'Withdraw',
          `Payouts to Bit / bank open soon. Your ${CURRENCY}${WITHDRAW_THRESHOLD} stays safe in your balance until then.`,
        )
      : Alert.alert('Almost there', `You need ${missing} more to withdraw.`);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={ui.root}>
        <SheetHeader title="Surveys & rewards" onClose={onClose} />

        <ScrollView contentContainerStyle={ui.scroll}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Your balance</Text>
            <Text style={styles.balanceValue}>{money(wallet.balance)}</Text>
            <ProgressBar value={withdrawProgress(wallet)} height={8} />
            <Text style={styles.progressHint}>
              {withdrawable
                ? 'You reached the withdrawal threshold! 🎉'
                : `${missing} to go until you can withdraw`}
            </Text>
            <TouchableOpacity
              style={[styles.withdrawButton, !withdrawable && styles.withdrawDisabled]}
              activeOpacity={0.85}
              onPress={handleWithdraw}
            >
              <Text style={styles.withdrawText}>
                Withdraw {CURRENCY}
                {WITHDRAW_THRESHOLD} 💸
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[ui.sectionLabel, styles.tight]}>
            {OFFERWALL_URL === null ? 'Try it out (demo surveys)' : 'Available surveys'}
          </Text>
          {OFFERWALL_URL === null && (
            <Text style={styles.demoNote}>
              These are practice surveys — real paying surveys arrive when the survey partner goes live.
            </Text>
          )}

          {DEMO_OFFERS.map((offer) => {
            const done = doneOffers.has(offer.id);
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
                <View style={ui.flex}>
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  <Text style={styles.offerMeta}>~{offer.minutes} min</Text>
                </View>
                {busy ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <View style={[styles.rewardPill, done && styles.rewardDone]}>
                    <Text style={styles.rewardText}>{done ? '✓ Done' : `+${money(offer.reward)}`}</Text>
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

const makeStyles = (COLORS: ThemeColors) => {
  const STICKER = stickerOf(COLORS);
  const STICKER_SM = stickerSmOf(COLORS);
  return StyleSheet.create({
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    ...STICKER,
    shadowOffset: { width: 6, height: 6 },
  },
  balanceLabel: { fontSize: 12, color: COLORS.subtle, textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceValue: {
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.mint,
    marginTop: 4,
    marginBottom: 10,
    fontVariant: ['tabular-nums'],
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
  withdrawText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  tight: { marginBottom: 6 },
  demoNote: { fontSize: 13, color: COLORS.subtle, marginBottom: 12 },

  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...STICKER_SM,
  },
  offerDone: { opacity: 0.6 },
  offerEmoji: { fontSize: 28, marginRight: 12 },
  offerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  offerMeta: { fontSize: 13, color: COLORS.subtle, marginTop: 2 },
  rewardPill: { backgroundColor: COLORS.mintBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  rewardDone: { backgroundColor: COLORS.hairline },
  rewardText: { fontSize: 14, fontWeight: '800', color: COLORS.mint },
  });
};

export default React.memo(SurveysScreen);

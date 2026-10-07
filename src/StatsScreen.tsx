/**
 * bloop — My stats: streak, 7-day chart, records. All computed from the
 * O(1)-updated DailyStore; rendering a week is O(7).
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
} from 'react-native';

import {
  CURRENCY,
  formatMoney,
  formatTime,
  totalMinutes,
  streakDays,
  lastDays,
  bestDay,
  type LifetimeStats,
  type DailyStore,
} from './core';

const COLORS = {
  background: '#FDF3E3',
  card: '#FFFDF8',
  primary: '#F4772E',
  mint: '#1D9E82',
  mintBg: '#DFF5EF',
  ink: '#1B1511',
  subtle: '#8A7B6D',
  hairline: '#F0E4D0',
} as const;

const STICKER = {
  borderWidth: 3,
  borderColor: '#1B1511',
  shadowColor: '#1B1511',
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
} as const;

const CHART_HEIGHT = 120;

interface Props {
  visible: boolean;
  stats: LifetimeStats;
  daily: DailyStore;
  onClose: () => void;
}

const StatsScreen: React.FC<Props> = ({ visible, stats, daily, onClose }) => {
  const streak = streakDays(daily);
  const week = lastDays(daily, 7);
  const weekMax = Math.max(1, ...week.map((d) => d.agg.seconds));
  const weekEarned = week.reduce((sum, d) => sum + d.agg.earned, 0);
  const best = bestDay(daily);
  const avgSeconds =
    stats.sessions > 0 ? Math.round(stats.totalSeconds / stats.sessions) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>My stats</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close stats"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.streakCard, streak > 0 && styles.streakActive]}>
            <Text style={styles.streakEmoji}>{streak > 0 ? '🔥' : '🧻'}</Text>
            <Text style={styles.streakValue}>
              {streak > 0
                ? `${streak} day streak!`
                : 'No streak yet — go earn!'}
            </Text>
            <Text style={styles.streakHint}>
              {streak > 0
                ? 'Keep blooping every day to grow it.'
                : 'One session today starts the fire.'}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Last 7 days</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartRow}>
              {week.map((d, i) => {
                const h = Math.max(
                  6,
                  Math.round((d.agg.seconds / weekMax) * CHART_HEIGHT),
                );
                const isToday = i === week.length - 1;
                return (
                  <View key={d.key} style={styles.barCol}>
                    <Text style={styles.barValue}>
                      {d.agg.seconds > 0 ? totalMinutes(d.agg.seconds) : ''}
                    </Text>
                    <View
                      style={[
                        styles.bar,
                        { height: h },
                        isToday ? styles.barToday : null,
                        d.agg.seconds === 0 ? styles.barEmpty : null,
                      ]}
                    />
                    <Text
                      style={[styles.barLabel, isToday && styles.barLabelToday]}
                    >
                      {d.label}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.chartFoot}>
              minutes per day · this week you earned {CURRENCY}
              {formatMoney(weekEarned)}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Records</Text>
          <View style={styles.grid}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={styles.statValue}>
                {formatTime(daily.bestSessionSeconds)}
              </Text>
              <Text style={styles.statLabel}>Longest session</Text>
            </View>
            <View style={[styles.statCard, styles.statCardMint]}>
              <Text style={styles.statEmoji}>💎</Text>
              <Text style={[styles.statValue, styles.mintText]}>
                {CURRENCY}
                {formatMoney(best ? best.earned : 0)}
              </Text>
              <Text style={styles.statLabel}>Best day</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🚽</Text>
              <Text style={styles.statValue}>{stats.sessions}</Text>
              <Text style={styles.statLabel}>Total sessions</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>⏳</Text>
              <Text style={styles.statValue}>{formatTime(avgSeconds)}</Text>
              <Text style={styles.statLabel}>Avg session</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🕰️</Text>
              <Text style={styles.statValue}>
                {totalMinutes(stats.totalSeconds)}
                <Text style={styles.statUnit}> min</Text>
              </Text>
              <Text style={styles.statLabel}>Lifetime time</Text>
            </View>
            <View style={[styles.statCard, styles.statCardMint]}>
              <Text style={styles.statEmoji}>💰</Text>
              <Text style={[styles.statValue, styles.mintText]}>
                {CURRENCY}
                {formatMoney(stats.totalEarned)}
              </Text>
              <Text style={styles.statLabel}>Lifetime earned</Text>
            </View>
          </View>
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

  streakCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    ...STICKER,
  },
  streakActive: { backgroundColor: '#FFE8D6' },
  streakEmoji: { fontSize: 40 },
  streakValue: { fontSize: 24, fontWeight: '800', color: COLORS.ink, marginTop: 6 },
  streakHint: { fontSize: 13, fontWeight: '600', color: COLORS.subtle, marginTop: 2 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 24,
    ...STICKER,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT + 36,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontSize: 10, fontWeight: '700', color: COLORS.subtle, marginBottom: 3 },
  bar: {
    width: 22,
    borderRadius: 7,
    backgroundColor: COLORS.mint,
    borderWidth: 2,
    borderColor: COLORS.ink,
  },
  barToday: { backgroundColor: COLORS.primary },
  barEmpty: { backgroundColor: COLORS.hairline, borderColor: COLORS.hairline },
  barLabel: { fontSize: 11, fontWeight: '700', color: COLORS.subtle, marginTop: 5 },
  barLabelToday: { color: COLORS.primary },
  chartFoot: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subtle,
    marginTop: 8,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    ...STICKER,
    borderWidth: 2.5,
    shadowOffset: { width: 3, height: 3 },
  },
  statCardMint: { backgroundColor: COLORS.mintBg },
  statEmoji: { fontSize: 24 },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  statUnit: { fontSize: 13, color: COLORS.subtle },
  mintText: { color: COLORS.mint },
  statLabel: { fontSize: 12, fontWeight: '600', color: COLORS.subtle, marginTop: 2 },
});

export default StatsScreen;

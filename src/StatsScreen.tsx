/**
 * bloop — My stats: streak, 7-day chart, records. All computed from the
 * DailyStore; rendering a week is O(7), records are O(1).
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, SafeAreaView } from 'react-native';

import { COLORS, STICKER, STICKER_SM, SheetHeader, ui } from './ui';
import {
  money,
  formatTime,
  totalMinutes,
  streakDays,
  lastDays,
  bestDayEarned,
  type LifetimeStats,
  type DailyStore,
} from './core';

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
  let weekMax = 1;
  let weekEarned = 0;
  for (const d of week) {
    weekMax = Math.max(weekMax, d.agg.seconds);
    weekEarned += d.agg.earned;
  }
  const avgSeconds = stats.sessions > 0 ? Math.round(stats.totalSeconds / stats.sessions) : 0;

  const records = [
    { emoji: '🏆', label: 'Longest session', value: formatTime(daily.bestSessionSeconds) },
    { emoji: '💎', label: 'Best day', value: money(bestDayEarned(daily)), mint: true },
    { emoji: '🚽', label: 'Total sessions', value: String(stats.sessions) },
    { emoji: '⏳', label: 'Avg session', value: formatTime(avgSeconds) },
    { emoji: '🕰️', label: 'Lifetime time', value: `${totalMinutes(stats.totalSeconds)} min` },
    { emoji: '💰', label: 'Lifetime earned', value: money(stats.totalEarned), mint: true },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={ui.root}>
        <SheetHeader title="My stats" onClose={onClose} />

        <ScrollView contentContainerStyle={ui.scroll}>
          <View style={[styles.streakCard, streak > 0 && styles.streakActive]}>
            <Text style={styles.streakEmoji}>{streak > 0 ? '🔥' : '🧻'}</Text>
            <Text style={styles.streakValue}>
              {streak > 0 ? `${streak} day streak!` : 'No streak yet — go earn!'}
            </Text>
            <Text style={styles.streakHint}>
              {streak > 0 ? 'Keep blooping every day to grow it.' : 'One session today starts the fire.'}
            </Text>
          </View>

          <Text style={ui.sectionLabel}>Last 7 days</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartRow}>
              {week.map((d, i) => {
                const isToday = i === week.length - 1;
                const empty = d.agg.seconds === 0;
                return (
                  <View key={d.key} style={styles.barCol}>
                    <Text style={styles.barValue}>{empty ? '' : totalMinutes(d.agg.seconds)}</Text>
                    <View
                      style={[
                        styles.bar,
                        { height: Math.max(6, Math.round((d.agg.seconds / weekMax) * CHART_HEIGHT)) },
                        isToday && styles.barToday,
                        empty && styles.barEmpty,
                      ]}
                    />
                    <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{d.label}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.chartFoot}>
              minutes per day · this week you earned {money(weekEarned)}
            </Text>
          </View>

          <Text style={ui.sectionLabel}>Records</Text>
          <View style={styles.grid}>
            {records.map((r) => (
              <View key={r.label} style={[styles.statCard, r.mint && styles.statCardMint]}>
                <Text style={styles.statEmoji}>{r.emoji}</Text>
                <Text style={[styles.statValue, r.mint && ui.mintText]}>{r.value}</Text>
                <Text style={styles.statLabel}>{r.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  streakCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    ...STICKER,
  },
  streakActive: { backgroundColor: COLORS.peach },
  streakEmoji: { fontSize: 40 },
  streakValue: { fontSize: 24, fontWeight: '800', color: COLORS.ink, marginTop: 6 },
  streakHint: { fontSize: 13, fontWeight: '600', color: COLORS.subtle, marginTop: 2 },

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
  bar: { width: 22, borderRadius: 7, backgroundColor: COLORS.mint, borderWidth: 2, borderColor: COLORS.ink },
  barToday: { backgroundColor: COLORS.primary },
  barEmpty: { backgroundColor: COLORS.hairline, borderColor: COLORS.hairline },
  barLabel: { fontSize: 11, fontWeight: '700', color: COLORS.subtle, marginTop: 5 },
  barLabelToday: { color: COLORS.primary },
  chartFoot: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: COLORS.subtle, marginTop: 8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    ...STICKER_SM,
  },
  statCardMint: { backgroundColor: COLORS.mintBg },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.ink, marginTop: 4, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontWeight: '600', color: COLORS.subtle, marginTop: 2 },
});

// memo: only re-render when stats/daily/visibility actually change.
export default React.memo(StatsScreen);

/**
 * bloop — first-launch tour: four swipeable cards that show what the app
 * can do. Shown once (persisted flag), skippable at any point.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';

import { useThemed, stickerOf, haptic, SPACING, type ThemeColors } from './ui';

const { width: W } = Dimensions.get('window');

interface Page {
  emoji: string;
  title: string;
  text: string;
}

const PAGES: readonly Page[] = [
  {
    emoji: '⏱️💸',
    title: 'Clock in. Sit down. Cash out.',
    text: 'Hit Start when nature calls — bloop counts every second of your break as money earned, live.',
  },
  {
    emoji: '👥👑',
    title: 'Race your friends',
    text: 'Pick a username, add your friends, and fight for the crown on the earnings leaderboard.',
  },
  {
    emoji: '⏰🧻',
    title: "Set your Poop o'clock",
    text: 'A daily reminder at your sacred hour, so you never miss a paid appointment with the throne.',
  },
  {
    emoji: '🌙🛍',
    title: 'Make it yours',
    text: 'Flip the sun-moon switch for night mode, tweak everything in Settings, and grab merch in the shop.',
  },
] as const;

interface Props {
  visible: boolean;
  onDone: () => void;
}

const Onboarding: React.FC<Props> = ({ visible, onDone }) => {
  const { styles, ui } = useThemed(makeStyles);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const next = Math.round(e.nativeEvent.contentOffset.x / W);
    if (next !== page) {
      haptic.light();
      setPage(next);
    }
  };

  const finish = (): void => {
    haptic.success();
    onDone();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={finish}>
      <SafeAreaView style={ui.root}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={finish} accessibilityLabel="Skip tour">
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
        >
          {PAGES.map((p) => (
            <View key={p.title} style={styles.page}>
              <Text style={styles.emoji}>{p.emoji}</Text>
              <Text style={styles.title}>{p.title}</Text>
              <Text style={styles.text}>{p.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View key={p.title} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={finish}>
          <Text style={styles.ctaText}>{last ? "Let's bloop! 🚀" : 'Got it — start blooping'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (COLORS: ThemeColors) => {
  const STICKER = stickerOf(COLORS);
  return StyleSheet.create({
    topRow: { alignItems: 'flex-end', paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
    skip: { fontSize: 15, fontWeight: '700', color: COLORS.subtle },
    page: {
      width: W,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
    },
    emoji: { fontSize: 72 },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: COLORS.ink,
      textAlign: 'center',
      marginTop: SPACING.lg,
    },
    text: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.subtle,
      textAlign: 'center',
      marginTop: SPACING.sm,
      lineHeight: 23,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: SPACING.md,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: COLORS.hairline,
      borderWidth: 1.5,
      borderColor: COLORS.ink,
    },
    dotActive: { backgroundColor: COLORS.primary },
    cta: {
      backgroundColor: COLORS.primary,
      borderRadius: 18,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      ...STICKER,
    },
    ctaText: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  });
};

export default Onboarding;

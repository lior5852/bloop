/**
 * bloop — Friends: claim a username, add friends (request + approval),
 * and compete on a lifetime-earnings leaderboard. Anonymous-friendly.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured } from './config';
import {
  ensureIdentity,
  getMyUsername,
  claimUsername,
  findUser,
  sendRequest,
  listIncoming,
  acceptRequest,
  listFriends,
  FriendsError,
  type FriendProfile,
  type IncomingRequest,
} from './friends';
import {
  CURRENCY,
  formatMoney,
  parseJSON,
  STORAGE_KEYS,
  type LifetimeStats,
} from './core';

const REPORT_EMAIL = 'lior5852@gmail.com';

const COLORS = {
  background: '#FDF3E3',
  card: '#FFFDF8',
  primary: '#F4772E',
  mint: '#1D9E82',
  mintBg: '#DFF5EF',
  ink: '#1B1511',
  subtle: '#8A7B6D',
  hairline: '#F0E4D0',
  gold: '#FFD166',
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
  stats: LifetimeStats;
  onClose: () => void;
}

const FriendsScreen: React.FC<Props> = ({ visible, stats, onClose }) => {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>('');
  const [addInput, setAddInput] = useState<string>('');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [blocked, setBlocked] = useState<readonly string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.blocked)
      .then((raw: string | null) => setBlocked(parseJSON<string[]>(raw, [])))
      .catch(() => {});
  }, []);

  const blockUser = useCallback(
    async (userId: string, username: string): Promise<void> => {
      const next = [...new Set([...blocked, userId])];
      setBlocked(next);
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.blocked, JSON.stringify(next));
      } catch {
        /* non-fatal */
      }
      Alert.alert('Blocked', `@${username} won't appear in your bloop anymore.`);
    },
    [blocked],
  );

  const reportUser = useCallback((username: string): void => {
    const subject = encodeURIComponent(`Report user @${username} — bloop`);
    const body = encodeURIComponent(
      `I want to report the user @${username}.\n\nReason:\n`,
    );
    Linking.openURL(
      `mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`,
    ).catch(() =>
      Alert.alert('Report', `Please email ${REPORT_EMAIL} to report @${username}.`),
    );
  }, []);

  const showUserActions = useCallback(
    (userId: string, username: string): void => {
      Alert.alert(`@${username}`, 'What would you like to do?', [
        { text: 'Report 🚩', onPress: () => reportUser(username) },
        {
          text: 'Block 🚫',
          style: 'destructive',
          onPress: () => blockUser(userId, username),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [reportUser, blockUser],
  );

  const refresh = useCallback(async (): Promise<void> => {
    if (!configured) return;
    setLoading(true);
    try {
      await ensureIdentity();
      const name = await getMyUsername();
      setUsername(name);
      if (name) {
        const [f, inc] = await Promise.all([listFriends(), listIncoming()]);
        setFriends(f);
        setIncoming(inc);
      }
    } catch (e) {
      const msg =
        e instanceof FriendsError ? e.message : 'Could not reach the server.';
      Alert.alert('Friends', msg);
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const handleClaim = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const claimed = await claimUsername(nameInput);
      setUsername(claimed);
      Alert.alert('Welcome! 🎉', `You are @${claimed}. Now add some friends!`);
    } catch (e) {
      Alert.alert(
        'Username',
        e instanceof FriendsError ? e.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  }, [nameInput]);

  const handleAdd = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const target = await findUser(addInput);
      if (!target) {
        Alert.alert('Not found', `No user named @${addInput.trim().toLowerCase()}.`);
        return;
      }
      await sendRequest(target.id);
      setAddInput('');
      Alert.alert('Sent! 📨', `Request sent to @${target.username}. They need to approve it.`);
    } catch (e) {
      Alert.alert(
        'Add friend',
        e instanceof FriendsError ? e.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  }, [addInput]);

  const handleAccept = useCallback(
    async (req: IncomingRequest): Promise<void> => {
      setBusy(true);
      try {
        await acceptRequest(req.id);
        await refresh();
      } catch (e) {
        Alert.alert(
          'Approve',
          e instanceof FriendsError ? e.message : 'Something went wrong.',
        );
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const visibleFriends = friends.filter((f) => !blocked.includes(f.id));
  const visibleIncoming = incoming.filter((r) => !blocked.includes(r.fromId));

  const leaderboard: Array<FriendProfile & { me?: boolean }> = username
    ? [
        {
          id: 'me',
          username,
          totalEarned: stats.totalEarned,
          totalSeconds: stats.totalSeconds,
          me: true,
        },
        ...visibleFriends,
      ].sort((a, b) => b.totalEarned - a.totalEarned)
    : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close friends">
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!configured && (
            <View style={styles.cardCenter}>
              <Text style={styles.bigEmoji}>🔌</Text>
              <Text style={styles.cardTitle}>Server coming online soon</Text>
              <Text style={styles.cardText}>
                Friends and competitions need the bloop server. It's almost
                ready — check back in the next update!
              </Text>
            </View>
          )}

          {configured && loading && (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
          )}

          {configured && !loading && username === null && (
            <View style={styles.cardCenter}>
              <Text style={styles.bigEmoji}>🥸</Text>
              <Text style={styles.cardTitle}>Pick your username</Text>
              <Text style={styles.cardText}>
                Totally anonymous — this is the only thing friends will see,
                along with your earnings. Choose wisely.
              </Text>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="toilet_king_99"
                placeholderTextColor={COLORS.subtle}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
              />
              <TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={handleClaim}>
                <Text style={styles.primaryButtonText}>Claim it 👑</Text>
              </TouchableOpacity>
            </View>
          )}

          {configured && !loading && username !== null && (
            <>
              {visibleIncoming.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Waiting for your approval</Text>
                  {visibleIncoming.map((req) => (
                    <View key={req.id} style={styles.requestRow}>
                      <Text style={styles.requestName}>@{req.fromUsername}</Text>
                      <View style={styles.rowActions}>
                        <TouchableOpacity
                          style={styles.approveButton}
                          disabled={busy}
                          onPress={() => handleAccept(req)}
                        >
                          <Text style={styles.approveText}>Approve ✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.moreButton}
                          accessibilityLabel={`Report or block ${req.fromUsername}`}
                          onPress={() =>
                            showUserActions(req.fromId, req.fromUsername)
                          }
                        >
                          <Text style={styles.moreText}>⋯</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}

              <Text style={styles.sectionLabel}>Leaderboard 🏆</Text>
              <View style={styles.boardCard}>
                {leaderboard.map((p, i) => (
                  <View
                    key={p.id}
                    style={[styles.boardRow, p.me ? styles.boardRowMe : null, i === 0 ? styles.boardRowTop : null]}
                  >
                    <Text style={styles.boardRank}>
                      {i === 0 ? '👑' : `${i + 1}.`}
                    </Text>
                    <Text style={styles.boardName}>
                      @{p.username}
                      {p.me ? ' (you)' : ''}
                    </Text>
                    <Text style={styles.boardMoney}>
                      {CURRENCY}
                      {formatMoney(p.totalEarned)}
                    </Text>
                    {!p.me && (
                      <TouchableOpacity
                        style={styles.moreButton}
                        accessibilityLabel={`Report or block ${p.username}`}
                        onPress={() => showUserActions(p.id, p.username)}
                      >
                        <Text style={styles.moreText}>⋯</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {friends.length === 0 && (
                  <Text style={styles.emptyHint}>
                    Just you here so far — add a friend below and race them to
                    the throne.
                  </Text>
                )}
              </View>

              <Text style={styles.sectionLabel}>Add a friend</Text>
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, styles.addInput]}
                  value={addInput}
                  onChangeText={setAddInput}
                  placeholder="friend_username"
                  placeholderTextColor={COLORS.subtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={16}
                  onSubmitEditing={handleAdd}
                />
                <TouchableOpacity style={styles.addButton} disabled={busy} onPress={handleAdd}>
                  <Text style={styles.primaryButtonText}>Add ➕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.footHint}>
                They'll need to approve you — no stalking allowed. 🚽
              </Text>
            </>
          )}
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
  spinner: { marginTop: 40 },

  cardCenter: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    ...STICKER,
  },
  bigEmoji: { fontSize: 44 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink, marginTop: 8 },
  cardText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.subtle,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  input: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.background,
    borderWidth: 2.5,
    borderColor: COLORS.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.ink,
    marginTop: 16,
  },
  primaryButton: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    ...STICKER,
  },
  primaryButtonText: { color: '#FFFDF8', fontSize: 16, fontWeight: '800' },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 10,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFE8D6',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...STICKER,
    borderWidth: 2.5,
    shadowOffset: { width: 3, height: 3 },
  },
  requestName: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  approveButton: {
    backgroundColor: COLORS.mint,
    borderWidth: 2.5,
    borderColor: COLORS.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  approveText: { color: '#FFFDF8', fontSize: 14, fontWeight: '800' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moreButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  moreText: { fontSize: 16, fontWeight: '800', color: COLORS.subtle },

  boardCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    ...STICKER,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  boardRowTop: { },
  boardRowMe: { },
  boardRank: { width: 34, fontSize: 16, fontWeight: '800', color: COLORS.ink },
  boardName: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.ink },
  boardMoney: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.mint,
    fontVariant: ['tabular-nums'],
  },
  emptyHint: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subtle,
    textAlign: 'center',
    paddingVertical: 12,
  },

  addRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  addInput: { flex: 1, marginTop: 0 },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    ...STICKER,
    shadowOffset: { width: 3, height: 3 },
  },
  footHint: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subtle,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default FriendsScreen;

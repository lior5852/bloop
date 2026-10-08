/**
 * bloop — Friends: claim a username, add friends (request + approval),
 * and compete on a lifetime-earnings leaderboard. Anonymous-friendly.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { COLORS, STICKER, STICKER_SM, SheetHeader, ui } from './ui';
import {
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
  money,
  parseJSON,
  STORAGE_KEYS,
  type LifetimeStats,
} from './core';

const REPORT_EMAIL = 'lior5852@gmail.com';

interface Props {
  visible: boolean;
  stats: LifetimeStats;
  onClose: () => void;
}

/** Show a FriendsError's message, or a generic fallback. */
const alertError = (title: string, e: unknown, fallback = 'Something went wrong.'): void =>
  Alert.alert(title, e instanceof FriendsError ? e.message : fallback);

const FriendsScreen: React.FC<Props> = ({ visible, stats, onClose }) => {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>('');
  const [addInput, setAddInput] = useState<string>('');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  // Set → O(1) "is blocked?" lookups (an array made every filter O(F·B)).
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.blocked)
      .then((raw: string | null) => setBlocked(new Set(parseJSON<string[]>(raw, []))))
      .catch(() => {});
  }, []);

  const blockUser = useCallback(
    (userId: string, username: string): void => {
      const next = new Set(blocked).add(userId);
      setBlocked(next);
      AsyncStorage.setItem(STORAGE_KEYS.blocked, JSON.stringify([...next])).catch(() => {});
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
      const name = await getMyUsername(); // also ensures an identity
      setUsername(name);
      if (name) {
        const [f, inc] = await Promise.all([listFriends(), listIncoming()]);
        setFriends(f);
        setIncoming(inc);
      }
    } catch (e) {
      alertError('Friends', e, 'Could not reach the server.');
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
      alertError('Username', e);
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
      alertError('Add friend', e);
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
        alertError('Approve', e);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const visibleIncoming = useMemo(
    () => incoming.filter((r) => !blocked.has(r.fromId)),
    [incoming, blocked],
  );

  // friends arrive already sorted (desc) from the server, so "me" is placed
  // with one O(F) insertion instead of re-sorting O(F log F) every render.
  const leaderboard = useMemo((): Array<FriendProfile & { me?: boolean }> => {
    if (!username) return [];
    const rows: Array<FriendProfile & { me?: boolean }> = friends.filter((f) => !blocked.has(f.id));
    const me = { id: 'me', username, totalEarned: stats.totalEarned, totalSeconds: stats.totalSeconds, me: true };
    const at = rows.findIndex((f) => f.totalEarned < me.totalEarned);
    rows.splice(at === -1 ? rows.length : at, 0, me);
    return rows;
  }, [friends, blocked, username, stats.totalEarned, stats.totalSeconds]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={ui.root}>
        <SheetHeader title="Friends" onClose={onClose} />

        <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
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
                  <Text style={[ui.sectionLabel, styles.sectionGap]}>Waiting for your approval</Text>
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

              <Text style={[ui.sectionLabel, styles.sectionGap]}>Leaderboard 🏆</Text>
              <View style={styles.boardCard}>
                {leaderboard.map((p, i) => (
                  <View
                    key={p.id}
                    style={styles.boardRow}
                  >
                    <Text style={styles.boardRank}>
                      {i === 0 ? '👑' : `${i + 1}.`}
                    </Text>
                    <Text style={styles.boardName}>
                      @{p.username}
                      {p.me ? ' (you)' : ''}
                    </Text>
                    <Text style={styles.boardMoney}>{money(p.totalEarned)}</Text>
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

              <Text style={[ui.sectionLabel, styles.sectionGap]}>Add a friend</Text>
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

  sectionGap: { marginTop: 20 },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.peach,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...STICKER_SM,
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
    ...STICKER_SM,
    borderWidth: 3,
  },
  footHint: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subtle,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default React.memo(FriendsScreen);

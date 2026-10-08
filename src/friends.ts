/**
 * bloop — friends & competition data layer (Supabase-backed).
 *
 * Identity model, as designed: everything can stay anonymous — the only
 * shared, public things are a unique username and lifetime totals. We use
 * Supabase anonymous sign-in, so no Apple/Google OAuth is required for
 * friends to work. Requires:
 *   - src/config.ts filled with the Supabase URL + anon key
 *   - "Anonymous Sign-ins" enabled in Supabase Auth settings
 *   - the SQL in AUTH_SETUP.md §6 executed (profiles, friend_requests, RLS)
 */
import { supabase } from './supabase';
import { isSupabaseConfigured } from './config';
import {
  isValidUsername,
  isCleanUsername,
  normalizeUsername,
  type LifetimeStats,
} from './core';

export class FriendsError extends Error {}

export interface FriendProfile {
  id: string;
  username: string;
  totalEarned: number;
  totalSeconds: number;
}

export interface IncomingRequest {
  id: string;
  fromId: string;
  fromUsername: string;
}

interface ProfileRow {
  id?: string;
  username?: string;
  total_earned?: number | string | null;
  total_seconds?: number | string | null;
}

const PROFILE_COLUMNS = 'id, username, total_earned, total_seconds';

/** DB row (snake_case) -> app shape. Shared by findUser + listFriends. */
const toProfile = (row: ProfileRow | null | undefined): FriendProfile | null =>
  row?.id && row.username
    ? {
        id: row.id,
        username: row.username,
        totalEarned: Number(row.total_earned ?? 0),
        totalSeconds: Number(row.total_seconds ?? 0),
      }
    : null;

/** Ensure we have a server identity (anonymous is fine). Returns user id. */
export const ensureIdentity = async (): Promise<string> => {
  if (!isSupabaseConfigured()) {
    throw new FriendsError('Server is not configured yet.');
  }
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) {
    throw new FriendsError(error?.message ?? 'Could not create identity.');
  }
  return anon.user.id;
};

/** My claimed username, or null if none yet. */
export const getMyUsername = async (): Promise<string | null> => {
  const uid = await ensureIdentity();
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', uid)
    .maybeSingle();
  return (data?.username as string | undefined) ?? null;
};

/** Claim a unique public username. Throws if invalid or taken. */
export const claimUsername = async (raw: string): Promise<string> => {
  if (!isValidUsername(raw)) {
    throw new FriendsError(
      'Username must be 3-16 letters, numbers or underscores.',
    );
  }
  if (!isCleanUsername(raw)) {
    throw new FriendsError("That username isn't allowed. Try another one.");
  }
  const uid = await ensureIdentity();
  const username = normalizeUsername(raw);
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: uid, username }, { onConflict: 'id' });
  if (error) {
    if (error.code === '23505') {
      throw new FriendsError('That username is already taken.');
    }
    throw new FriendsError(error.message);
  }
  return username;
};

/** Push my lifetime totals to my public profile (fire-and-forget safe). */
export const syncMyStats = async (stats: LifetimeStats): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;
    await supabase
      .from('profiles')
      .update({
        total_earned: stats.totalEarned,
        total_seconds: stats.totalSeconds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', uid);
  } catch {
    /* never block the app on a sync */
  }
};

/** Find a user by exact username (to send them a request). */
export const findUser = async (raw: string): Promise<FriendProfile | null> => {
  await ensureIdentity();
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('username', normalizeUsername(raw))
    .maybeSingle();
  return toProfile(data as ProfileRow | null);
};

/** Send a friend request (pending until the other side approves). */
export const sendRequest = async (toId: string): Promise<void> => {
  const uid = await ensureIdentity();
  if (toId === uid) throw new FriendsError("That's you! 🚽");
  const { error } = await supabase
    .from('friend_requests')
    .insert({ from_id: uid, to_id: toId });
  if (error) {
    if (error.code === '23505') {
      throw new FriendsError('Request already sent (or you are friends).');
    }
    throw new FriendsError(error.message);
  }
};

/** Requests waiting for MY approval. */
export const listIncoming = async (): Promise<IncomingRequest[]> => {
  const uid = await ensureIdentity();
  const { data } = await supabase
    .from('friend_requests')
    .select('id, from_id, profiles!friend_requests_from_id_fkey(username)')
    .eq('to_id', uid)
    .eq('status', 'pending');
  interface IncomingRow {
    id: string | number;
    from_id: string;
    profiles: { username?: string } | null;
  }
  return ((data ?? []) as IncomingRow[]).map((row) => ({
    id: String(row.id),
    fromId: row.from_id,
    fromUsername: row.profiles?.username ?? 'unknown',
  }));
};

/** Approve a pending request addressed to me. */
export const acceptRequest = async (requestId: string): Promise<void> => {
  const uid = await ensureIdentity();
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .eq('to_id', uid);
  if (error) throw new FriendsError(error.message);
};

/** My friends (accepted, either direction) with their public totals. */
export const listFriends = async (): Promise<FriendProfile[]> => {
  const uid = await ensureIdentity();
  const { data } = await supabase
    .from('friend_requests')
    .select(
      `from_id, from_profile:profiles!friend_requests_from_id_fkey(${PROFILE_COLUMNS}), to_profile:profiles!friend_requests_to_id_fkey(${PROFILE_COLUMNS})`,
    )
    .eq('status', 'accepted')
    .or(`from_id.eq.${uid},to_id.eq.${uid}`);

  interface FriendRow {
    from_id: string;
    from_profile: ProfileRow | null;
    to_profile: ProfileRow | null;
  }
  return ((data ?? []) as unknown as FriendRow[])
    .map((row) => toProfile(row.from_id === uid ? row.to_profile : row.from_profile))
    .filter((p): p is FriendProfile => p !== null)
    .sort((a, b) => b.totalEarned - a.totalEarned);
};

/**
 * bloop — real sign-in (Apple + Google) backed by Supabase.
 *
 * Both providers get a native ID token on-device, then exchange it with
 * Supabase via signInWithIdToken. Supabase creates/returns a real user row and
 * a session that persists across launches and devices.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { supabase } from './supabase';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  isGoogleConfigured,
  isSupabaseConfigured,
} from './config';
import {
  isValidEmail,
  isValidUsername,
  isCleanUsername,
  isValidPassword,
  normalizeUsername,
  MIN_PASSWORD_LENGTH,
  type User,
  type AuthProvider,
} from './core';

export class AuthError extends Error {}

/** Map a Supabase user into the app's User shape. */
const mapUser = (
  u: SupabaseUser,
  provider: AuthProvider,
  fallbackName?: string,
): User => {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    fallbackName ||
    (u.email ? u.email.split('@')[0] : 'there');
  return {
    id: u.id,
    name: String(name).trim(),
    email: (u.email ?? '').toLowerCase(),
    provider,
    createdAt: u.created_at ? Date.parse(u.created_at) : Date.now(),
  };
};

let googleConfigured = false;
const ensureGoogleConfigured = (): void => {
  if (googleConfigured) return;
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
  googleConfigured = true;
};

/* --------------------------- Email + password --------------------------- */

const validateSignUp = (
  username: string,
  email: string,
  password: string,
  confirm: string,
): void => {
  if (!isValidUsername(username)) {
    throw new AuthError('Username must be 3-16 letters, numbers or underscores.');
  }
  if (!isCleanUsername(username)) {
    throw new AuthError("That username isn't allowed. Try another one.");
  }
  if (!isValidEmail(email)) {
    throw new AuthError('Please enter a valid email.');
  }
  if (!isValidPassword(password)) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password !== confirm) {
    throw new AuthError("Passwords don't match.");
  }
};

/** Claim the public username for the signed-in user (unique in profiles). */
const claimUsernameRow = async (uid: string, username: string): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: uid, username: normalizeUsername(username) }, { onConflict: 'id' });
  if (error) {
    if (error.code === '23505') {
      throw new AuthError('That username is already taken.');
    }
    throw new AuthError(error.message);
  }
};

/** Create a real server account: email + password + unique username. */
export const signUpWithEmail = async (
  username: string,
  email: string,
  password: string,
  confirm: string,
): Promise<User> => {
  if (!isSupabaseConfigured()) {
    throw new AuthError('Sign-up is unavailable right now. Try again later.');
  }
  validateSignUp(username, email, password, confirm);

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { username: normalizeUsername(username) } },
  });
  if (error) {
    if (/already registered/i.test(error.message)) {
      throw new AuthError('This email is already registered. Try logging in.');
    }
    throw new AuthError(error.message);
  }
  if (!data.user || !data.session) {
    throw new AuthError('Check your email to confirm your account, then log in.');
  }

  await claimUsernameRow(data.user.id, username);
  return { ...mapUser(data.user, 'email'), name: normalizeUsername(username) };
};

/** Log in to an existing email account. */
export const signInWithEmail = async (
  email: string,
  password: string,
): Promise<User> => {
  if (!isSupabaseConfigured()) {
    throw new AuthError('Login is unavailable right now. Try again later.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    throw new AuthError('Wrong email or password.');
  }

  // Prefer the public username as the display name.
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', data.user.id)
    .maybeSingle();
  const username = (profile?.username as string | undefined) ?? undefined;
  return { ...mapUser(data.user, 'email', username), name: username ?? mapUser(data.user, 'email').name };
};

/* ------------------------------ Apple ----------------------------------- */

export const signInWithApple = async (): Promise<User> => {
  if (!isSupabaseConfigured()) {
    throw new AuthError('Supabase is not configured yet.');
  }
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new AuthError('Sign in with Apple is not available on this device.');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new AuthError('No identity token returned from Apple.');
  }

  // Apple only returns the name on the very first sign-in.
  const appleName = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName]
        .filter(Boolean)
        .join(' ')
    : undefined;

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error || !data.user) {
    throw new AuthError(error?.message ?? 'Apple sign-in failed.');
  }
  return mapUser(data.user, 'apple', appleName);
};

/* ------------------------------ Google ---------------------------------- */

export const signInWithGoogle = async (): Promise<User> => {
  if (!isSupabaseConfigured()) {
    throw new AuthError('Supabase is not configured yet.');
  }
  if (!isGoogleConfigured()) {
    throw new AuthError('Google sign-in is not configured yet.');
  }
  ensureGoogleConfigured();

  try {
    await GoogleSignin.hasPlayServices();
    const result = await GoogleSignin.signIn();

    // Support both newer ({ data }) and older (flat) response shapes.
    const idToken: string | undefined =
      (result as { data?: { idToken?: string } }).data?.idToken ??
      (result as { idToken?: string }).idToken;

    if (!idToken) {
      throw new AuthError('No ID token returned from Google.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error || !data.user) {
      throw new AuthError(error?.message ?? 'Google sign-in failed.');
    }
    return mapUser(data.user, 'google');
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      throw new AuthError('Sign-in cancelled.');
    }
    throw e instanceof Error ? e : new AuthError('Google sign-in failed.');
  }
};

/* ------------------------------ Session --------------------------------- */

/** Return the currently signed-in user, or null. */
export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const provider = (u.app_metadata?.provider as AuthProvider) ?? 'local';
  return mapUser(u, provider);
};

export const signOut = async (): Promise<void> => {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut();
  }
  if (googleConfigured) {
    try {
      await GoogleSignin.signOut();
    } catch {
      /* ignore */
    }
  }
};

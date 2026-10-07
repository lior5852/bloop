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
import type { User, AuthProvider } from './core';

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

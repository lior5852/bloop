/**
 * bloop — auth & backend configuration.
 *
 * Fill these in after creating the projects (see AUTH_SETUP.md).
 * Until they are filled, the app falls back to local email sign-up and the
 * Apple/Google buttons show a friendly "not configured yet" message.
 *
 * NOTE: the anon key and OAuth client IDs are PUBLIC values (safe to ship in
 * an app). Never put a Supabase service_role key or any secret here.
 */

// From Supabase → Project Settings → API Keys (publishable key — safe to ship)
export const SUPABASE_URL = 'https://jcevqymomwylozdyrlxv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_RrRrd6Iy3_CClSiDVUvtBQ_B-GTQx_r';

// From Google Cloud Console → Credentials → OAuth 2.0 Client IDs
// iOS client ID is required on-device; web client ID is used as the Supabase
// "Authorized Client ID" and to request an ID token Supabase can verify.
export const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
export const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

/**
 * Show the Apple/Google sign-in buttons. Keep false until the OAuth providers
 * are actually configured (Google Cloud + Apple capability + Supabase
 * providers), otherwise App Review sees non-working buttons.
 * Friends/leaderboard do NOT need this — they use anonymous sign-in.
 */
export const SOCIAL_LOGIN_ENABLED = false;

const isPlaceholder = (v: string): boolean =>
  v.startsWith('YOUR') || v.includes('YOUR-PROJECT');

/** True once Supabase URL + anon key are real values. */
export const isSupabaseConfigured = (): boolean =>
  !isPlaceholder(SUPABASE_URL) && !isPlaceholder(SUPABASE_ANON_KEY);

/** True once the Google client IDs are real values. */
export const isGoogleConfigured = (): boolean =>
  !isPlaceholder(GOOGLE_IOS_CLIENT_ID) && !isPlaceholder(GOOGLE_WEB_CLIENT_ID);

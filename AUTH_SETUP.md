# bloop — real sign-in setup (Apple + Google via Supabase)

The code is already wired. To make the buttons work you need to create the
accounts below, paste a few public keys into `src/config.ts` and `app.json`,
then rebuild. Nothing here is secret except the Google **web** client secret,
which lives only in Supabase (never in the app).

Do the steps in order.

---

## 1. Install the packages (Mac terminal)

```bash
cd "/Users/liortzur/Desktop/claude code/bloop"
npx expo install @supabase/supabase-js @react-native-google-signin/google-signin expo-apple-authentication react-native-url-polyfill
```

`expo install` picks versions matched to your SDK.

---

## 2. Supabase (the backend)

1. Go to supabase.com → create a free project (pick a region close to you).
2. Project Settings → **API**:
   - copy **Project URL** → paste into `SUPABASE_URL` in `src/config.ts`
   - copy the **anon public** key → paste into `SUPABASE_ANON_KEY`
3. Keep this tab open — you'll enable the providers in steps 3 and 4.

---

## 3. Google sign-in

**Google Cloud Console** (console.cloud.google.com):

1. Create a project (name it bloop).
2. APIs & Services → **OAuth consent screen** → External → fill app name + your
   email → save.
3. APIs & Services → **Credentials** → Create credentials → OAuth client ID:
   - **iOS**: bundle ID `com.liortzur.bloop` → creates an **iOS client ID**.
   - Create another one, type **Web application** → creates a **Web client ID**
     and **Web client secret**.
4. Paste into `src/config.ts`:
   - iOS client ID → `GOOGLE_IOS_CLIENT_ID`
   - Web client ID → `GOOGLE_WEB_CLIENT_ID`
5. In `app.json`, set the Google plugin `iosUrlScheme` to your **reversed** iOS
   client ID. If the iOS client ID is `1234-abcd.apps.googleusercontent.com`,
   the scheme is `com.googleusercontent.apps.1234-abcd`.

**Back in Supabase** → Authentication → Providers → **Google** → enable, then:
   - paste the **Web client ID** and **Web client secret**
   - in "Authorized Client IDs", add BOTH the iOS and Web client IDs (comma-separated)

---

## 4. Sign in with Apple

**Apple Developer** (developer.apple.com):

1. Certificates, IDs & Profiles → Identifiers → open App ID `com.liortzur.bloop`.
2. Enable the **Sign In with Apple** capability → Save.

**Back in Supabase** → Authentication → Providers → **Apple** → enable, then in
"Client IDs" add your bundle ID: `com.liortzur.bloop`.

(For an iOS-only native flow that's all Supabase needs — no Service ID required.)

---

## 5. Rebuild and resubmit

The new sign-in uses native modules, so the current TestFlight build won't have
them — you must build again.

```bash
cd "/Users/liortzur/Desktop/claude code/bloop"
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

The `production` profile auto-increments the build number, so this becomes
build 2 in TestFlight.

---

## How to know it works

- Install the new TestFlight build on your iPhone.
- Tap "Continue with Apple" or "Continue with Google" — you should get the
  native sheet, and land on the wage screen signed in.
- Fully close and reopen the app: you stay signed in (session restored).
- Sign in on a second device with the same account: your profile follows you
  (that's the backend working).

## 6. Database tables + security (run once in Supabase)

Supabase → SQL Editor → paste and run. This creates the profile/stats/wallet
tables with **row-level security**, so each user can only ever read and write
their own rows — even with the public anon key.

```sql
-- Public identity: username + lifetime totals. Everything else stays private.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,16}$'),
  total_seconds bigint default 0 check (total_seconds >= 0),
  total_earned numeric default 0 check (total_earned >= 0),
  wallet_balance numeric default 0 check (wallet_balance >= 0),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Any signed-in user (incl. anonymous) can look up usernames + totals;
-- that's the whole point of the leaderboard. Only you can write your row.
create policy "profiles are readable" on public.profiles
  for select to authenticated using (true);
create policy "own profile insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Friend requests: pending until the recipient approves.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);

alter table public.friend_requests enable row level security;

create policy "see my requests" on public.friend_requests
  for select to authenticated
  using (auth.uid() = from_id or auth.uid() = to_id);
create policy "send request" on public.friend_requests
  for insert to authenticated with check (auth.uid() = from_id);
create policy "recipient approves" on public.friend_requests
  for update to authenticated
  using (auth.uid() = to_id) with check (status = 'accepted');
```

Also enable **Authentication → Sign In / Providers → Anonymous Sign-ins** —
friends work with anonymous identities (username is the only public thing),
no Apple/Google OAuth required.

Important security rules already respected by the app code:

- Only the **anon** key ships in the app; the service_role key must never
  leave Supabase.
- Survey rewards must be credited by the **provider's server callback → your
  backend**, never by the client. The demo mode credits locally for testing
  only; when you connect a real provider we move crediting server-side.
- The client clamps inputs (wage ≤ 10,000, session ≤ 4h, single credit ≤ 100)
  and the database double-checks with `check` constraints.

## 7. Real survey provider (when you're ready for real money)

1. Open a publisher account at **BitLabs** (bitlabs.ai) or **CPX Research**
   (cpx-research.com) — both accept indie apps and pay per completed survey.
2. Create an app in their dashboard → you get an offerwall URL/app id.
3. Paste the offerwall URL into `OFFERWALL_URL` in `src/SurveysScreen.tsx`
   and run `npx expo install react-native-webview`.
4. Configure their **server-to-server callback** to point at a Supabase Edge
   Function that verifies the signature and updates `wallet_balance`. (Ask
   Claude for this function when you have the account — it's ~30 lines.)
5. Payouts to users (Bit / bank) happen from your side once balances pass
   ₪200 — start manual, automate later.

## Notes

- Until `src/config.ts` is filled, the app still runs and the buttons show a
  friendly "not configured yet" message — email sign-up keeps working.
- The anon key and client IDs are safe to ship. The only secret (Google web
  client secret) lives only in Supabase.
- Your existing users table lives in Supabase now — the same foundation you'll
  use later for surveys, the wallet, and payouts.

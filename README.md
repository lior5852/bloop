# bloop 🚽💸

Track how much money you make while using the restroom at work. iOS-first Expo + TypeScript app.

## Stack

- Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict)
- `lottie-react-native` for animations · `@react-native-async-storage/async-storage` for persistence

## Run it locally

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server and open iOS
npx expo start --ios
```

Press `i` to open the iOS simulator, or scan the QR code with the Expo Go app on your iPhone.

## Flow

`Auth → Set wage (once) → Tracker` — then it stays on Tracker on every launch.

1. **Auth** — cute colorful sign-up with name + email (stored locally). "Continue with Apple" and "Continue with Google" buttons are styled placeholders for real OAuth later.
2. **Set wage** — entered once and remembered forever. Change it anytime from the side drawer; never asked again on launch.
3. **Tracker** — the main screen.

## What's inside

- **Tracker** — live MM:SS stopwatch, real-time `You earned: ₪X.XX` counter, and a `<LottieView>` animation. Three stat cards up top: hourly wage, total minutes accumulated (lifetime), and total theoretical earnings (lifetime).
- **Side drawer** (hamburger, top-left) — profile, lifetime stats, edit hourly wage, log out, and delete account (wipes all local data). Also a "Surveys & rewards" item with a progress bar toward the ₪200 withdrawal threshold.
- **Summary modal** — iOS bottom-sheet recap of time + money for each break; its result is folded into lifetime totals.
- **Ad slot** — an `AdBanner` placeholder reserves layout space for a future ad network.

## Architecture

- `src/core.ts` — all business logic (earnings, formatting, lifetime aggregation, wage/email validation, wallet threshold rules, safe JSON). Framework-agnostic, no React Native imports, fully unit-tested.
- `App.tsx` — the UI, importing rules from `core.ts`.

## Tests

```bash
npm test
```

Runs the flow and structure suite (`src/core.test.ts`) with Node's built-in test runner — 34 tests covering earnings math (incl. 4-hour session clamp), session aggregation, wage parsing (incl. abuse bounds), email validation, wallet crediting guards, withdrawal thresholds, and the full signup → wage → sessions flow. No jest install required.

```bash
npm run typecheck   # strict TypeScript check of the whole project
```

## Surveys & rewards (working demo, provider-ready)

The drawer's "Surveys & rewards" opens a full screen: balance, progress bar to the ₪200 threshold, a withdraw button, and demo surveys that credit the wallet (with abuse guards: single credit ≤ ₪100, validated amounts). To switch to real paying surveys, open a BitLabs/CPX publisher account and set `OFFERWALL_URL` in `src/SurveysScreen.tsx` — see AUTH_SETUP.md §7.

## Polish & effects

Haptic feedback on all key actions (start/finish/menu), pulsing Lottie while a session runs, and an emoji confetti burst when a break completes.

## Future hooks (already scaffolded)

- **Ads** — the `AdBanner` component is where a network like `react-native-google-mobile-ads` plugs in; the layout space is already reserved.
- **Real sign-in** — Apple/Google via Supabase is fully coded; fill `src/config.ts` per AUTH_SETUP.md and rebuild.

## Path to the App Store

You'll need an **Apple Developer account** ($99/year) — this is required by Apple to publish, and must be created under your own name and payment. Once you have it, no Mac or Xcode is needed; Expo builds in the cloud.

```bash
# 1. Install the EAS CLI and log in to your Expo account
npm install -g eas-cli
eas login

# 2. Link the project (creates it on your Expo account)
eas init

# 3. Build a production iOS binary in the cloud
eas build --platform ios --profile production

# 4. Submit the finished build to App Store Connect
eas submit --platform ios --latest
```

After submitting, finish the listing in App Store Connect (screenshots, description, privacy policy) and send it for Apple review (typically 1–3 days).

## Notes

- The Lottie animation loads from a remote URL for zero-setup. To bundle it later, drop a `.json` into `assets/` and swap `source={{ uri: ... }}` for `source={require('./assets/coins.json')}`.
- Currency symbol is `₪` (shekel) — change the `CURRENCY` constant in `src/core.ts` to switch.
- The app icon and splash are Expo placeholders — replace the PNGs in `assets/` with your own artwork before publishing.
- Wage and lifetime stats persist across launches; edit or reset from the side drawer.

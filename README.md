# bloop 🚽💸

Track how much money you make while using the restroom at work. iOS-first Expo + TypeScript MVP.

## Run it today

From a fresh Expo project (or your existing one), drop in `App.tsx` and `app.json`, then:

```bash
# 1. Create the project (skip if you already have one)
npx create-expo-app@latest bloop --template blank-typescript
cd bloop

# 2. Install the two required libraries
npx expo install lottie-react-native @react-native-async-storage/async-storage

# 3. Replace App.tsx with the one in this folder, then start
npx expo start --ios
```

Press `i` in the terminal to open the iOS simulator, or scan the QR code with the Expo Go app on your iPhone.

## What's inside

- **Profile setup** — iOS-style hourly wage input, saved locally via AsyncStorage. Non-functional "Sign in with Apple" placeholder for the future auth flow.
- **Tracker** — live MM:SS stopwatch, real-time `You earned: ₪X.XX` counter, and a `<LottieView>` animation (loaded from a remote URL, no local asset needed).
- **Summary modal** — iOS bottom-sheet style recap of time + money for the break.

## Notes

- The Lottie animation is loaded from a remote URL for zero-setup. To ship a bundled asset later, download a `.json` into `assets/` and swap `source={{ uri: ... }}` for `source={require('./assets/coins.json')}`.
- Currency symbol is `₪` (shekel) — change the `CURRENCY` constant in `App.tsx` to switch.
- Wage persists across launches; tap **Edit wage** on the tracker to change it.

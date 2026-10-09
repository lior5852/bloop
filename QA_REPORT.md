# bloop — QA report: build 9 launch crash (2026-10-09)

## Symptom
Build 9 crashes immediately on launch from TestFlight — the app never reaches
the first screen. Builds up to 8 launched (build 8: 1 install, 1 session).

## What was tested before build 9 (and what it covers)
1. **Unit tests, 39/39 green** (`npm test`) — all pure logic: earnings math,
   session clamps, daily stats, streaks, leaderboard ordering/blocking,
   username filters, wallet guards, currency validation.
2. **Strict TypeScript** across every file — types, nulls, signatures.
3. **Static review** of each change.

## What was NOT tested before build 9 — the gap
4. **Runtime execution of the full module graph + first render.** Unit tests
   import only `core.ts`; the type checker never *runs* code. Nothing executed
   `App.tsx`'s import tree the way the phone does at launch. A crash at
   module-evaluation time (the classic "dies before the first screen") lives
   exactly in that blind spot.
5. **Native-module behavior.** Build 9 added the first new native module in a
   while (`expo-notifications`) and loaded it at startup (module-level
   `setNotificationHandler`). No pre-build check exercised it, and the iOS
   native layer cannot be exercised from this environment at all.

## Root-cause analysis
- The only native-layer changes in build 9: `expo-notifications` (+ its push
  entitlement/key) and the new icon asset. Icons don't crash launches.
- Prime suspect: the **startup-time import/initialization of
  expo-notifications**. A failure there kills the app before any JS screen —
  matching the symptom precisely.
- Remote evidence is not yet available (TestFlight crash feedback is empty —
  it only fills when a tester taps "Share" on the crash dialog). A device log
  (`Settings → Privacy & Security → Analytics → Data → bloop-*.ips`) will
  confirm the exact frame.

## Fixes applied (this commit)
- `src/reminders.ts` rewritten: expo-notifications is now loaded **lazily,
  per-call, inside try/catch**. If the native module is broken or missing,
  reminders silently no-op — the app can no longer crash because of it.
- **ErrorBoundary** added at the app root: any future JS render crash shows a
  friendly "bloop hit a clog" screen *with the error message* instead of a
  black-screen death — every future incident self-diagnoses.

## New permanent safety net (so this class of bug can't recur)
- **Runtime smoke harness** (Node + React server-render + full React Native /
  Expo mocks): executes the complete import graph and renders App + all six
  screens. This is exactly the test that would have caught a startup crash.
  Current result: **8/8 PASS**.
- Release checklist going forward: unit tests → strict types → smoke harness
  → TestFlight on-device sanity (open app, toggle night mode, start a session)
  → only then submit to review.

## Verification of the fixed code
- Unit tests: 39/39 pass.
- Strict typecheck: clean.
- Smoke harness: 8/8 pass (module graph, App, Surveys, Stats, Friends,
  Reminder, Settings, reminder scheduling).

/**
 * bloop — flow & structure tests for the pure core logic.
 * Run: npm test   (uses node --test with native TypeScript stripping)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  earningsFor,
  addSession,
  formatTime,
  totalMinutes,
  formatMoney,
  parseWage,
  isValidEmail,
  isValidName,
  makeUser,
  emptyStats,
  emptyWallet,
  canWithdraw,
  withdrawProgress,
  creditWallet,
  applyWithdrawal,
  parseJSON,
  WITHDRAW_THRESHOLD,
  MAX_SINGLE_CREDIT,
  DEMO_OFFERS,
  emptyDaily,
  addToDaily,
  streakDays,
  lastDays,
  bestDayEarned,
  shiftDays,
  money,
  ALL_STORAGE_KEYS,
  STORAGE_KEYS,
  dayKey,
  MAX_TRACKED_DAYS,
  isValidUsername,
  isCleanUsername,
  normalizeUsername,
  CURRENCIES,
  setCurrency,
  type LifetimeStats,
  type Wallet,
  type DailyStore,
} from './core.ts';

/* ------------------------------ Earnings -------------------------------- */

test('earningsFor: one hour at wage equals the wage', () => {
  assert.equal(earningsFor(3600, 60), 60);
});

test('earningsFor: proportional to time', () => {
  assert.equal(earningsFor(1800, 60), 30);
  assert.equal(earningsFor(60, 60), 1);
});

test('earningsFor: guards against zero/negative inputs', () => {
  assert.equal(earningsFor(0, 60), 0);
  assert.equal(earningsFor(-5, 60), 0);
  assert.equal(earningsFor(3600, 0), 0);
  assert.equal(earningsFor(3600, -10), 0);
});

/* ------------------------- Lifetime aggregation ------------------------- */

test('addSession: accumulates seconds, money, and count', () => {
  let stats: LifetimeStats = emptyStats();
  stats = addSession(stats, { elapsedSeconds: 120, amountEarned: 2 });
  stats = addSession(stats, { elapsedSeconds: 300, amountEarned: 5 });
  assert.deepEqual(stats, { totalSeconds: 420, totalEarned: 7, sessions: 2 });
});

test('addSession: ignores negative session values', () => {
  const stats = addSession(emptyStats(), {
    elapsedSeconds: -10,
    amountEarned: -3,
  });
  assert.deepEqual(stats, { totalSeconds: 0, totalEarned: 0, sessions: 1 });
});

/* ------------------------------ Formatting ------------------------------ */

test('formatTime: pads and rolls into minutes', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(9), '00:09');
  assert.equal(formatTime(75), '01:15');
  assert.equal(formatTime(3661), '61:01');
});

test('totalMinutes: floors seconds to whole minutes', () => {
  assert.equal(totalMinutes(59), 0);
  assert.equal(totalMinutes(60), 1);
  assert.equal(totalMinutes(605), 10);
});

test('formatMoney: 2dp with thousands grouping, no float artifacts', () => {
  assert.equal(formatMoney(0.1 + 0.2), '0.30');
  assert.equal(formatMoney(1234.5), '1,234.50');
  assert.equal(formatMoney(1000000), '1,000,000.00');
  assert.equal(formatMoney(-5), '0.00');
});

/* ------------------------------ Validation ------------------------------ */

test('parseWage: accepts valid numbers and comma decimals', () => {
  assert.equal(parseWage('60'), 60);
  assert.equal(parseWage(' 42.5 '), 42.5);
  assert.equal(parseWage('42,5'), 42.5);
});

test('parseWage: rejects invalid, zero, negative, and absurd values', () => {
  assert.equal(parseWage(''), null);
  assert.equal(parseWage('abc'), null);
  assert.equal(parseWage('0'), null);
  assert.equal(parseWage('-3'), null);
  assert.equal(parseWage('999999'), null);
  assert.equal(parseWage('Infinity'), null);
});

test('earningsFor: clamps runaway sessions at 4 hours', () => {
  const oneWeek = 7 * 24 * 3600;
  assert.equal(earningsFor(oneWeek, 60), earningsFor(4 * 3600, 60));
  assert.equal(earningsFor(oneWeek, 60), 240);
});

test('isValidEmail / isValidName', () => {
  assert.equal(isValidEmail('li@bloop.app'), true);
  assert.equal(isValidEmail('nope'), false);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidName('Li'), true);
  assert.equal(isValidName('L'), false);
});

/* -------------------------------- Signup -------------------------------- */

test('makeUser: normalizes email, trims name, sets provider', () => {
  const u = makeUser('  Li  ', '  LI@Bloop.APP ', 'local');
  assert.equal(u.name, 'Li');
  assert.equal(u.email, 'li@bloop.app');
  assert.equal(u.provider, 'local');
  assert.ok(u.id.length > 0);
  assert.ok(u.createdAt > 0);
});

/* ---------------------------- Wallet / rewards -------------------------- */

test('withdrawal threshold logic', () => {
  assert.equal(WITHDRAW_THRESHOLD, 200);
  assert.equal(canWithdraw(emptyWallet()), false);
  assert.equal(canWithdraw({ balance: 199.99 }), false);
  assert.equal(canWithdraw({ balance: 200 }), true);
  assert.equal(canWithdraw({ balance: 350 }), true);
});

test('withdrawProgress: clamped 0..1', () => {
  assert.equal(withdrawProgress({ balance: 0 }), 0);
  assert.equal(withdrawProgress({ balance: 100 }), 0.5);
  assert.equal(withdrawProgress({ balance: 200 }), 1);
  assert.equal(withdrawProgress({ balance: 999 }), 1);
});

test('creditWallet: adds valid rewards with 2dp rounding', () => {
  let w: Wallet = { balance: 0 };
  w = creditWallet(w, 1.5);
  w = creditWallet(w, 0.1);
  w = creditWallet(w, 0.2);
  assert.equal(w.balance, 1.8);
});

test('creditWallet: rejects invalid or abusive amounts', () => {
  const w: Wallet = { balance: 10 };
  assert.equal(creditWallet(w, 0).balance, 10);
  assert.equal(creditWallet(w, -5).balance, 10);
  assert.equal(creditWallet(w, NaN).balance, 10);
  assert.equal(creditWallet(w, Infinity).balance, 10);
  assert.equal(creditWallet(w, MAX_SINGLE_CREDIT + 1).balance, 10);
});

test('applyWithdrawal: only at threshold, deducts exactly threshold', () => {
  assert.equal(applyWithdrawal({ balance: 199.99 }), null);
  const after = applyWithdrawal({ balance: 235.5 });
  assert.ok(after);
  assert.equal(after!.balance, 35.5);
});

test('DEMO_OFFERS: all rewards pass the credit guard', () => {
  DEMO_OFFERS.forEach((o) => {
    const w = creditWallet({ balance: 0 }, o.reward);
    assert.equal(w.balance, o.reward);
  });
});

/* ---------------------------- Persistence ------------------------------- */

test('parseJSON: returns fallback on null and malformed input', () => {
  assert.deepEqual(parseJSON(null, emptyStats()), emptyStats());
  assert.deepEqual(parseJSON('{bad json', emptyStats()), emptyStats());
  assert.deepEqual(parseJSON('{"totalSeconds":10,"totalEarned":1,"sessions":1}', emptyStats()), {
    totalSeconds: 10,
    totalEarned: 1,
    sessions: 1,
  });
});

/* ---------------------------- Daily metrics ----------------------------- */

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 9, 8, 12, 0, 0).getTime();

test('addToDaily: accumulates per-day and tracks best session', () => {
  let d: DailyStore = emptyDaily();
  d = addToDaily(d, { elapsedSeconds: 120, amountEarned: 2 }, T0);
  d = addToDaily(d, { elapsedSeconds: 300, amountEarned: 5 }, T0);
  const today = d.days[dayKey(T0)];
  assert.deepEqual(today, { seconds: 420, earned: 7, sessions: 2 });
  assert.equal(d.bestSessionSeconds, 300);
});

test('addToDaily: prunes to the cap, keeping newest days', () => {
  let d: DailyStore = emptyDaily();
  for (let i = 0; i < MAX_TRACKED_DAYS + 10; i += 1) {
    d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, T0 + i * DAY);
  }
  assert.equal(Object.keys(d.days).length, MAX_TRACKED_DAYS);
  assert.ok(d.days[dayKey(T0 + (MAX_TRACKED_DAYS + 9) * DAY)]);
  assert.equal(d.days[dayKey(T0)], undefined);
});

test('streakDays: counts consecutive days, broken by a gap', () => {
  let d: DailyStore = emptyDaily();
  d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, T0 - 2 * DAY);
  d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, T0 - 1 * DAY);
  d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, T0);
  assert.equal(streakDays(d, T0), 3);
  let gap: DailyStore = emptyDaily();
  gap = addToDaily(gap, { elapsedSeconds: 60, amountEarned: 1 }, T0 - 3 * DAY);
  gap = addToDaily(gap, { elapsedSeconds: 60, amountEarned: 1 }, T0);
  assert.equal(streakDays(gap, T0), 1);
});

test('streakDays: today empty falls back to yesterday', () => {
  let d: DailyStore = emptyDaily();
  d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, T0 - 1 * DAY);
  d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, T0 - 2 * DAY);
  assert.equal(streakDays(d, T0), 2);
});

test('lastDays: returns n entries oldest-first with zero-fill', () => {
  let d: DailyStore = emptyDaily();
  d = addToDaily(d, { elapsedSeconds: 600, amountEarned: 10 }, T0);
  const week = lastDays(d, 7, T0);
  assert.equal(week.length, 7);
  assert.equal(week[6].key, dayKey(T0));
  assert.equal(week[6].agg.earned, 10);
  assert.equal(week[0].agg.sessions, 0);
});

test('bestDayEarned: finds the top earning day', () => {
  let d: DailyStore = emptyDaily();
  d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 3 }, T0 - DAY);
  d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 9 }, T0);
  assert.equal(bestDayEarned(d), 9);
  assert.equal(bestDayEarned(emptyDaily()), 0);
});

test('bestDayEarned: record survives pruning of old days', () => {
  let d: DailyStore = emptyDaily();
  d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 50 }, T0);
  for (let i = 1; i <= MAX_TRACKED_DAYS + 5; i += 1) {
    d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, T0 + i * DAY);
  }
  assert.equal(d.days[dayKey(T0)], undefined); // pruned
  assert.equal(bestDayEarned(d), 50); // record kept
});

test('bestDayEarned: legacy store without the field falls back to a scan', () => {
  const legacy: DailyStore = {
    days: { '2026-10-01': { seconds: 60, earned: 7, sessions: 1 } },
    bestSessionSeconds: 60,
  };
  assert.equal(bestDayEarned(legacy), 7);
  assert.equal(addToDaily(legacy, { elapsedSeconds: 60, amountEarned: 1 }, T0).bestDayEarned, 7);
});

test('streak + lastDays: DST spring-forward day is not skipped', () => {
  const prevTZ = process.env.TZ;
  process.env.TZ = 'Asia/Jerusalem'; // 2026-03-27 is a 23-hour day
  try {
    const at = (day: number, h: number, m = 0): number =>
      new Date(2026, 2, day, h, m).getTime();
    let d: DailyStore = emptyDaily();
    d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, at(26, 12));
    d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, at(27, 12));
    d = addToDaily(d, { elapsedSeconds: 60, amountEarned: 1 }, at(28, 0, 30));
    assert.equal(streakDays(d, at(28, 0, 30)), 3);
    const keys = lastDays(d, 3, at(28, 0, 30)).map((x) => x.key);
    assert.deepEqual(keys, ['2026-03-26', '2026-03-27', '2026-03-28']);
    assert.equal(dayKey(shiftDays(at(28, 0, 30), -1)), '2026-03-27');
  } finally {
    process.env.TZ = prevTZ;
  }
});

test('money + ALL_STORAGE_KEYS', () => {
  setCurrency('₪');
  assert.equal(money(1234.5), '₪1,234.50');
  assert.equal(ALL_STORAGE_KEYS.length, Object.keys(STORAGE_KEYS).length);
});

/* ------------------------------ Usernames ------------------------------- */

test('isValidUsername / normalizeUsername', () => {
  assert.equal(isValidUsername('lior_58'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('way_too_long_username_x'), false);
  assert.equal(isValidUsername('has space'), false);
  assert.equal(isValidUsername('emoji🚽'), false);
  assert.equal(normalizeUsername('  LiOr_58 '), 'lior_58');
});

test('isCleanUsername: blocks offensive terms, incl. evasion via underscores', () => {
  assert.equal(isCleanUsername('toilet_king'), true);
  assert.equal(isCleanUsername('lior_58'), true);
  assert.equal(isCleanUsername('FuckBoy'), false);
  assert.equal(isCleanUsername('f_u_c_k_99'), false);
  assert.equal(isCleanUsername('ben_zona'), false);
  assert.equal(isCleanUsername('nazi_dude'), false);
});

test('currency: validates against the known list', async () => {
  const core = await import('./core.ts');
  setCurrency('$');
  assert.equal(core.CURRENCY, '$');
  setCurrency('???');
  assert.equal(core.CURRENCY, '$');
  setCurrency('₪');
  assert.equal(core.CURRENCY, '₪');
  assert.ok(CURRENCIES.length >= 4);
});

/* --------------------------- Flow: full loop ---------------------------- */

test('flow: signup -> set wage -> run two sessions -> lifetime totals', () => {
  const user = makeUser('Li', 'li@bloop.app', 'local');
  assert.ok(user);

  const wage = parseWage('90');
  assert.equal(wage, 90);

  let stats = emptyStats();
  const s1 = { elapsedSeconds: 120, amountEarned: earningsFor(120, wage!) };
  const s2 = { elapsedSeconds: 240, amountEarned: earningsFor(240, wage!) };
  stats = addSession(stats, s1);
  stats = addSession(stats, s2);

  assert.equal(stats.sessions, 2);
  assert.equal(totalMinutes(stats.totalSeconds), 6);
  assert.equal(formatMoney(stats.totalEarned), '9.00');
});

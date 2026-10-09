/**
 * bloop — core logic (framework-agnostic, no React Native imports).
 *
 * Everything here is pure and unit-testable. The UI in App.tsx imports from
 * this module so that business rules can be verified without a device.
 */

/* ------------------------------ Currency -------------------------------- */

export interface Currency {
  symbol: string;
  code: string;
  name: string;
}

/** Currencies the user can pick at signup (changeable anytime). */
export const CURRENCIES: readonly Currency[] = [
  { symbol: '₪', code: 'ILS', name: 'Israeli Shekel' },
  { symbol: '$', code: 'USD', name: 'US Dollar' },
  { symbol: '€', code: 'EUR', name: 'Euro' },
  { symbol: '£', code: 'GBP', name: 'British Pound' },
  { symbol: '¥', code: 'JPY', name: 'Japanese Yen' },
  { symbol: '₹', code: 'INR', name: 'Indian Rupee' },
] as const;

/**
 * The active currency symbol. A live ESM binding: importers always see the
 * current value, and setCurrency validates against the known list.
 */
export let CURRENCY = '₪';

export const setCurrency = (symbol: string): void => {
  if (CURRENCIES.some((c) => c.symbol === symbol)) {
    CURRENCY = symbol;
  }
};

/** Surveys/rewards MVP: users can withdraw once their wallet reaches this. */
export const WITHDRAW_THRESHOLD = 200;

export const STORAGE_KEYS = {
  user: '@bloop:user',
  wage: '@bloop:hourlyWage',
  stats: '@bloop:lifetimeStats',
  wallet: '@bloop:wallet',
  daily: '@bloop:dailyStats',
  blocked: '@bloop:blockedUsers',
  currency: '@bloop:currency',
  reminder: '@bloop:reminder',
  notifications: '@bloop:notificationsEnabled',
  emailOptIn: '@bloop:emailOptIn',
  onboarded: '@bloop:onboarded',
} as const;

/** Every key we own — "delete account" must wipe all of them. */
export const ALL_STORAGE_KEYS: readonly string[] = Object.values(STORAGE_KEYS);

/* ------------------------------- Types ---------------------------------- */

export type AuthProvider = 'local' | 'email' | 'apple' | 'google';

export interface User {
  id: string;
  name: string;
  email: string;
  provider: AuthProvider;
  createdAt: number;
}

/** Cumulative, never-reset totals across every logged session. */
export interface LifetimeStats {
  totalSeconds: number;
  totalEarned: number;
  sessions: number;
}

/** Future surveys/rewards balance (real ₪ the user can withdraw). */
export interface Wallet {
  balance: number;
}

export interface SessionResult {
  elapsedSeconds: number;
  amountEarned: number;
}

/* ----------------------------- Factories -------------------------------- */

export const emptyStats = (): LifetimeStats => ({
  totalSeconds: 0,
  totalEarned: 0,
  sessions: 0,
});

export const emptyWallet = (): Wallet => ({ balance: 0 });

export const makeUser = (
  name: string,
  email: string,
  provider: AuthProvider,
): User => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: name.trim(),
  email: email.trim().toLowerCase(),
  provider,
  createdAt: Date.now(),
});

/* ------------------------------ Earnings -------------------------------- */

/** Longest session we count (4h) — guards against forgotten timers. */
export const MAX_SESSION_SECONDS = 4 * 3600;

/** After this long we ask "still there?" (nobody bloops 40+ minutes). */
export const SESSION_PROMPT_SECONDS = 40 * 60;

/** Seconds the "still there?" prompt waits before auto-finishing. */
export const STILL_THERE_COUNTDOWN = 10;

/** Money earned for a duration at a given hourly wage. Never negative. */
export const earningsFor = (seconds: number, hourlyWage: number): number => {
  if (seconds <= 0 || hourlyWage <= 0) return 0;
  const clamped = Math.min(seconds, MAX_SESSION_SECONDS);
  return (hourlyWage / 3600) * clamped;
};

/** Fold a finished session into lifetime totals. */
export const addSession = (
  stats: LifetimeStats,
  result: SessionResult,
): LifetimeStats => ({
  totalSeconds: stats.totalSeconds + Math.max(0, result.elapsedSeconds),
  totalEarned: stats.totalEarned + Math.max(0, result.amountEarned),
  sessions: stats.sessions + 1,
});

/* ---------------------------- Formatting -------------------------------- */

const pad2 = (n: number): string => n.toString().padStart(2, '0');

/** Seconds -> "MM:SS" (minutes can exceed 99). */
export const formatTime = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
};

/** Whole minutes accumulated. */
export const totalMinutes = (totalSeconds: number): number =>
  Math.floor(Math.max(0, totalSeconds) / 60);

/** Deterministic thousands-grouped 2dp money string (Hermes-safe, no Intl). */
export const formatMoney = (amount: number): string => {
  const fixed = Math.max(0, amount).toFixed(2);
  const [intPart, dec] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped}.${dec}`;
};

/** Money with the active currency symbol, e.g. "₪12.50". */
export const money = (amount: number): string => `${CURRENCY}${formatMoney(amount)}`;

/* ---------------------------- Validation -------------------------------- */

/** Upper bound for a plausible hourly wage (abuse/typo guard). */
export const MAX_WAGE = 10000;

/** Parse a user-typed wage. Accepts comma decimals. Returns null if invalid. */
export const parseWage = (input: string): number | null => {
  const parsed = parseFloat(input.trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_WAGE) return null;
  return parsed;
};

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const isValidName = (name: string): boolean => name.trim().length >= 2;

export const MIN_PASSWORD_LENGTH = 8;

export const isValidPassword = (password: string): boolean =>
  password.length >= MIN_PASSWORD_LENGTH;

/* ------------------------------ Wallet ---------------------------------- */

/** Max single credit accepted from a survey completion (abuse guard). */
export const MAX_SINGLE_CREDIT = 100;

export const canWithdraw = (wallet: Wallet): boolean =>
  wallet.balance >= WITHDRAW_THRESHOLD;

/** 0..1 progress toward the withdrawal threshold. */
export const withdrawProgress = (wallet: Wallet): number => {
  const p = wallet.balance / WITHDRAW_THRESHOLD;
  return p < 0 ? 0 : p > 1 ? 1 : p;
};

/**
 * Credit a survey reward into the wallet.
 * Rejects non-positive, NaN, and absurdly large amounts (returns wallet as-is).
 */
export const creditWallet = (wallet: Wallet, amount: number): Wallet => {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_SINGLE_CREDIT) {
    return wallet;
  }
  return { balance: Math.round((wallet.balance + amount) * 100) / 100 };
};

/** Deduct a successful withdrawal. Returns null if not allowed. */
export const applyWithdrawal = (wallet: Wallet): Wallet | null => {
  if (!canWithdraw(wallet)) return null;
  return {
    balance: Math.round((wallet.balance - WITHDRAW_THRESHOLD) * 100) / 100,
  };
};

/* ------------------------------ Surveys --------------------------------- */

export interface SurveyOffer {
  id: string;
  title: string;
  minutes: number;
  reward: number;
  emoji: string;
}

/**
 * Demo offers shown until a real survey provider (e.g. BitLabs / CPX) is
 * connected. Rewards are intentionally small and pass creditWallet's guards.
 */
export const DEMO_OFFERS: readonly SurveyOffer[] = [
  { id: 'demo-1', title: 'Quick taste test', minutes: 2, reward: 1.5, emoji: '🍫' },
  { id: 'demo-2', title: 'Shopping habits', minutes: 5, reward: 4, emoji: '🛒' },
  { id: 'demo-3', title: 'Streaming & TV', minutes: 8, reward: 6.5, emoji: '📺' },
  { id: 'demo-4', title: 'Travel dreams', minutes: 12, reward: 10, emoji: '✈️' },
] as const;

/* --------------------------- Daily metrics ------------------------------ */
/*
 * Hash map  dayKey ("YYYY-MM-DD") -> DayAgg, capped at MAX_TRACKED_DAYS keys.
 * Records (best session / best day) are kept as running maxima, so they
 * survive pruning and cost O(1) to read.
 */

export interface DayAgg {
  seconds: number;
  earned: number;
  sessions: number;
}

export interface DailyStore {
  days: Record<string, DayAgg>;
  bestSessionSeconds: number;
  /** All-time best day. Optional: data saved by older builds lacks it. */
  bestDayEarned?: number;
}

export const MAX_TRACKED_DAYS = 60;

export const emptyDaily = (): DailyStore => ({
  days: {},
  bestSessionSeconds: 0,
  bestDayEarned: 0,
});

const emptyDay = (): DayAgg => ({ seconds: 0, earned: 0, sessions: 0 });

/** Local-timezone YYYY-MM-DD key for a timestamp. */
export const dayKey = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * Move a timestamp by whole calendar days. DST-safe: "minus 24h" skips a
 * day after a 23-hour spring-forward day; setDate() never does.
 */
export const shiftDays = (ts: number, days: number): number => {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
};

/** All-time best day — O(1) for new data, one O(D) scan for legacy data. */
export const bestDayEarned = (store: DailyStore): number =>
  store.bestDayEarned ??
  Object.values(store.days).reduce((m, d) => Math.max(m, d.earned), 0);

/** Fold a finished session into the daily store (immutable, pruned). */
export const addToDaily = (
  store: DailyStore,
  result: SessionResult,
  now: number = Date.now(),
): DailyStore => {
  const key = dayKey(now);
  const seconds = Math.max(0, Math.min(result.elapsedSeconds, MAX_SESSION_SECONDS));
  const prev = store.days[key] ?? emptyDay();
  const today: DayAgg = {
    seconds: prev.seconds + seconds,
    earned: prev.earned + Math.max(0, result.amountEarned),
    sessions: prev.sessions + 1,
  };
  const days = { ...store.days, [key]: today };
  // Keys are ISO dates, so lexicographic order == chronological order.
  for (const stale of Object.keys(days).sort().slice(0, -MAX_TRACKED_DAYS)) {
    delete days[stale];
  }
  return {
    days,
    bestSessionSeconds: Math.max(store.bestSessionSeconds, seconds),
    bestDayEarned: Math.max(bestDayEarned(store), today.earned),
  };
};

/** Consecutive active days ending today (or yesterday if today is empty). */
export const streakDays = (
  store: DailyStore,
  now: number = Date.now(),
): number => {
  let cursor = store.days[dayKey(now)] ? now : shiftDays(now, -1);
  let streak = 0;
  while (store.days[dayKey(cursor)]) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
};

export interface ChartDay {
  key: string;
  label: string;
  agg: DayAgg;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** The last `n` days (oldest first) with weekday labels, for charts. */
export const lastDays = (
  store: DailyStore,
  n: number,
  now: number = Date.now(),
): ChartDay[] =>
  Array.from({ length: n }, (_, i) => {
    const ts = shiftDays(now, i - (n - 1));
    const key = dayKey(ts);
    return {
      key,
      label: WEEKDAY_LETTERS[new Date(ts).getDay()],
      agg: store.days[key] ?? emptyDay(),
    };
  });

/* ----------------------------- Leaderboard ------------------------------ */

/** The public shape friends share: username + lifetime totals. */
export interface PublicProfile {
  id: string;
  username: string;
  totalEarned: number;
  totalSeconds: number;
}

export interface LeaderboardEntry extends PublicProfile {
  me?: boolean;
}

/**
 * Merge me + friends into a ranked board: blocked users removed, sorted by
 * lifetime earnings (ties broken by time, then name for stability).
 */
export const buildLeaderboard = (
  me: PublicProfile | null,
  friends: readonly PublicProfile[],
  blocked: readonly string[] = [],
): LeaderboardEntry[] => {
  const entries: LeaderboardEntry[] = friends
    .filter((f) => !blocked.includes(f.id))
    .map((f) => ({ ...f }));
  if (me) entries.push({ ...me, me: true });
  entries.sort(
    (a, b) =>
      b.totalEarned - a.totalEarned ||
      b.totalSeconds - a.totalSeconds ||
      a.username.localeCompare(b.username),
  );
  return entries;
};

/* ------------------------------ Usernames ------------------------------- */

/** 3–16 chars, letters/digits/underscore — the shared public identity. */
export const isValidUsername = (name: string): boolean =>
  /^[a-zA-Z0-9_]{3,16}$/.test(name.trim());

export const normalizeUsername = (name: string): string =>
  name.trim().toLowerCase();

/**
 * Offensive-term blocklist for usernames (App Store UGC guideline 1.2).
 * Substring match on the normalized name; deliberately strict — a username
 * is public, so false positives are acceptable.
 */
const BLOCKED_USERNAME_TERMS: readonly string[] = [
  'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'slut',
  'rape', 'nazi', 'hitler', 'porn', 'penis', 'vagina', 'dick', 'cock',
  'pussy', 'anal', 'nude', 'zona', 'sharmut', 'kusemek', 'benzona',
  'manyak', 'kakfan',
] as const;

/** True when the username contains no blocked term. */
export const isCleanUsername = (name: string): boolean => {
  const n = normalizeUsername(name).replace(/_/g, '');
  return !BLOCKED_USERNAME_TERMS.some((term) => n.includes(term));
};

/* ---------------------------- Persistence ------------------------------- */

/** Safe JSON parse with a typed fallback — never throws. */
export const parseJSON = <T>(raw: string | null, fallback: T): T => {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

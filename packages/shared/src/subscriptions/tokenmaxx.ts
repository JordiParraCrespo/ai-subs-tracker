import type { LimitWindow, SnapshotSource, SnapshotStatus } from '../schemas/accounts.schema';

/**
 * Tokenmaxx: get the most out of every plan you pay for.
 *
 * A plan's weekly allowance is use-it-or-lose-it: whatever is left at the
 * reset is gone. So the account to use next is the one that would waste the
 * most if you did not — the most headroom per hour left before its weekly
 * reset — among the accounts you can use right now. Pure, so the screens and
 * the desktop tray rank the same way.
 */

export const PACE_STATUSES = [
  'limit',
  'expiring',
  'behind',
  'on_pace',
  'ahead',
  'unknown',
] as const;
export type PaceStatus = (typeof PACE_STATUSES)[number];

export type PickReason = 'expiring_soon' | 'most_headroom' | 'only_available';

export interface RankableAccount {
  id: string;
  status: SnapshotStatus | null;
  windows: readonly LimitWindow[];
  /**
   * Where the windows came from and when; a `manual` or `unofficial` reading
   * is never refreshed by a sync.
   */
  reading?: { source: SnapshotSource; capturedAt: Date | string } | null;
}

export interface AccountPace {
  id: string;
  /** Percent of the weekly allowance used, or null when unknown. */
  weeklyUsed: number | null;
  /** Percent of the 5-hour session used; null when the plan has none or it is unknown. */
  sessionUsed: number | null;
  weeklyResetsAt: string | null;
  sessionResetsAt: string | null;
  /** Percent of the weekly allowance left. */
  left: number | null;
  hoursToReset: number | null;
  /** Where usage would be if spread evenly over the week, 0–100. */
  onPaceMark: number | null;
  /** Percent per day needed to use what is left before the reset. */
  neededPerDay: number | null;
  status: PaceStatus;
  /** True when it can take work right now (not at a limit, login valid). */
  usable: boolean;
  /** Headroom per hour until reset; the ranking key. */
  urgency: number;
}

const WEEK_HOURS = 7 * 24;
const AT_LIMIT = 98;

function pick(windows: readonly LimitWindow[], kind: LimitWindow['kind']) {
  return windows.find((w) => w.kind === kind && w.utilization !== null) ?? null;
}

function hoursUntil(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  return Math.max(0, (new Date(iso).getTime() - now.getTime()) / 3_600_000);
}

/**
 * The windows that still describe `now`. A collected reading is replaced
 * every sync, so it is taken as it is. A reading the person recorded by hand
 * is not, and neither is one from an unofficial endpoint, which stops
 * arriving when the desktop app is closed or the endpoint stops answering:
 * once a window has reset — or, with no reset given, once a whole window has
 * passed since it was recorded — what it said no longer holds, and the
 * window is unknown until a fresh reading.
 */
export function currentWindows(account: RankableAccount, now: Date): readonly LimitWindow[] {
  const source = account.reading?.source;
  if (!account.reading || (source !== 'manual' && source !== 'unofficial')) return account.windows;
  const recordedAt = new Date(account.reading.capturedAt).getTime();
  return account.windows.filter((window) => {
    const endsAt = window.resetsAt
      ? new Date(window.resetsAt).getTime()
      : window.windowMinutes
        ? recordedAt + window.windowMinutes * 60_000
        : Number.POSITIVE_INFINITY;
    return endsAt > now.getTime();
  });
}

export function paceOf(account: RankableAccount, now: Date): AccountPace {
  const windows = currentWindows(account, now);
  const weekly = pick(windows, 'weekly');
  const session = pick(windows, 'session');
  const weeklyUsed = weekly?.utilization ?? null;
  const sessionUsed = session?.utilization ?? null;
  const hoursToReset = hoursUntil(weekly?.resetsAt ?? null, now);
  const left = weeklyUsed === null ? null : Math.max(0, 100 - weeklyUsed);
  const windowHours = weekly?.windowMinutes ? weekly.windowMinutes / 60 : WEEK_HOURS;
  const onPaceMark =
    hoursToReset === null
      ? null
      : Math.min(100, Math.max(0, (1 - hoursToReset / windowHours) * 100));
  const neededPerDay =
    left === null || hoursToReset === null ? null : left / Math.max(hoursToReset / 24, 1 / 24);

  const loginOk = account.status === 'ok' || account.status === 'rate_limited';
  const atLimit =
    (weeklyUsed !== null && weeklyUsed >= AT_LIMIT) ||
    (sessionUsed !== null && sessionUsed >= AT_LIMIT);

  let status: PaceStatus;
  if (!loginOk || weeklyUsed === null) status = 'unknown';
  else if (atLimit) status = 'limit';
  else if (left !== null && hoursToReset !== null && left > 15 && hoursToReset <= 24)
    status = 'expiring';
  else if (onPaceMark !== null && weeklyUsed < onPaceMark - 10) status = 'behind';
  else if (onPaceMark !== null && weeklyUsed > onPaceMark + 10) status = 'ahead';
  else status = 'on_pace';

  const usable = loginOk && weeklyUsed !== null && !atLimit;
  const urgency = usable && left !== null ? left / Math.max(hoursToReset ?? windowHours, 0.25) : -1;

  return {
    id: account.id,
    weeklyUsed,
    sessionUsed,
    weeklyResetsAt: weekly?.resetsAt ?? null,
    sessionResetsAt: session?.resetsAt ?? null,
    left,
    hoursToReset,
    onPaceMark,
    neededPerDay,
    status,
    usable,
    urgency,
  };
}

export interface Ranking {
  /** Every account, the one to use next first; unusable ones last. */
  queue: AccountPace[];
  pick: AccountPace | null;
  reason: PickReason | null;
}

export function rankAccounts(accounts: readonly RankableAccount[], now: Date): Ranking {
  const queue = accounts
    .map((account) => paceOf(account, now))
    .sort((a, b) => b.urgency - a.urgency || (a.weeklyUsed ?? 101) - (b.weeklyUsed ?? 101));
  const usable = queue.filter((pace) => pace.usable);
  const top = usable[0] ?? null;
  let reason: PickReason | null = null;
  if (top) {
    if (usable.length === 1) reason = 'only_available';
    else if (top.status === 'expiring') reason = 'expiring_soon';
    else reason = 'most_headroom';
  }
  return { queue, pick: top, reason };
}

/**
 * The value a plan let expire: for each closed weekly period, the share of
 * the allowance never used, priced at the plan's monthly cost spread over the
 * weeks in a month. In US cents.
 */
export function wastedCents(
  periods: readonly { peakUtilization: number }[],
  monthlyPriceCents: number,
): number {
  const perWeek = (monthlyPriceCents * 7) / 30.44;
  return periods.reduce(
    (sum, period) => sum + (Math.max(0, 100 - period.peakUtilization) / 100) * perWeek,
    0,
  );
}

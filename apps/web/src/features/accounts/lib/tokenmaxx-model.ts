import type { AccountEntity } from '@flama/frontend-consumer';
import type { ProviderId } from '@flama/shared/subscriptions';
import { accountMark, accountTitle } from './marks';

/**
 * The design's Tokenmaxx model, over each account's weekly window: where use
 * would be on an even pace (`expected`), the pace needed to use what is left
 * before the reset (`need`, %/h), and what the current pace would leave
 * unused at the reset (`waste`, and its share of the price).
 */
export type TokenmaxxStatus = 'limit' | 'expiring' | 'under' | 'hot' | 'track';
export type TokenmaxxGoal = 'expiring' | 'headroom' | 'value' | 'pace';

export interface TokenmaxxRow {
  account: AccountEntity;
  name: string;
  initials: string;
  color: string;
  used: number;
  left: number;
  hours: number;
  windowHours: number;
  expected: number;
  need: number;
  waste: number;
  wasteCents: number;
  status: TokenmaxxStatus;
  score: number;
}

export function tokenmaxxRows(accounts: readonly AccountEntity[], now: Date): TokenmaxxRow[] {
  const rows: TokenmaxxRow[] = [];
  for (const account of accounts) {
    // An expired hand-recorded reading says nothing about this week.
    const weekly = account.currentWindow('weekly', now);
    if (!weekly || weekly.utilization === null || !weekly.resetsAt) continue;
    if (account.status !== 'ok' && account.status !== 'rate_limited') continue;
    const windowHours = (weekly.windowMinutes ?? 10_080) / 60;
    const hours = Math.max(0, (new Date(weekly.resetsAt).getTime() - now.getTime()) / 3_600_000);
    const used = Math.min(100, weekly.utilization);
    const elapsed = Math.max(1, windowHours - hours);
    const projected = Math.min(100, used + (used / elapsed) * hours);
    const left = Math.max(0, 100 - used);
    const need = left / Math.max(hours, 1);
    const expected = (elapsed / windowHours) * 100;
    const waste = Math.max(0, 100 - projected);
    const wasteCents = (account.monthlyPriceCents * (windowHours / 720) * waste) / 100;
    const status: TokenmaxxStatus =
      used >= 95
        ? 'limit'
        : hours <= 6 && left > 15
          ? 'expiring'
          : used < expected - 12
            ? 'under'
            : used > expected + 12
              ? 'hot'
              : 'track';
    const score =
      status === 'limit' ? -1 : left / Math.max(hours, 1) + (status === 'expiring' ? 100 : 0);
    const mark = accountMark(account);
    rows.push({
      account,
      name: accountTitle(account),
      initials: mark.initials,
      color: mark.color,
      used,
      left,
      hours,
      windowHours,
      expected,
      need,
      waste,
      wasteCents,
      status,
      score,
    });
  }
  return rows.sort((a, b) => b.score - a.score);
}

const GOAL_SCORE: Record<TokenmaxxGoal, (row: TokenmaxxRow) => number> = {
  expiring: (row) => row.score,
  headroom: (row) => row.left,
  value: (row) => (row.left * row.account.monthlyPriceCents) / (row.windowHours / 168),
  pace: (row) => -row.need,
};

/** The accounts the "Pick next for" filters allow, best first by the chosen goal. */
export function pickCandidates(
  rows: readonly TokenmaxxRow[],
  filters: { provider?: ProviderId; goal: TokenmaxxGoal; minLeft: number },
): TokenmaxxRow[] {
  return rows
    .filter(
      (row) =>
        row.status !== 'limit' &&
        (!filters.provider || row.account.provider === filters.provider) &&
        row.left >= filters.minLeft,
    )
    .sort((a, b) => GOAL_SCORE[filters.goal](b) - GOAL_SCORE[filters.goal](a));
}

import type { DailyTokens, UsageSnapshot } from '@flama/shared/schemas/accounts';
import type { WeeklyPeak } from '../domain/account.types';

export type { WeeklyPeak };

/** A model's tokens on one day for one account, summed across devices. */
export interface AccountDailyTokens extends DailyTokens {
  accountId: string;
}

/**
 * Port for an account's telemetry: limit readings and token counts. Not part
 * of the aggregate — it is append-only and read in bulk, so it has its own
 * port rather than riding on `AccountRepositoryPort`.
 */
export interface UsageRepositoryPort {
  /** Appends a reading and drops that account's readings older than the retention. */
  recordSnapshot(accountId: string, snapshot: UsageSnapshot, retentionDays: number): Promise<void>;
  /** Replaces what `device` reported for each day it sends. */
  replaceDailyTokens(accountId: string, device: string, rows: DailyTokens[]): Promise<void>;
  latestSnapshots(accountIds: string[]): Promise<Map<string, UsageSnapshot>>;
  /** Weekly windows that reset between `since` and `now`, with their peak. */
  weeklyPeaks(accountIds: string[], since: Date, now: Date): Promise<Map<string, WeeklyPeak[]>>;
  dailyTokens(accountIds: string[], sinceDay: string): Promise<AccountDailyTokens[]>;
}

import type { UsageSnapshot } from '@flama/shared/schemas/accounts';
import type { AccountEntity } from './account.entity';

/** The highest a weekly window got before it reset. */
export interface WeeklyPeak {
  resetsAt: Date;
  peakUtilization: number;
}

/** An account with what its screens read beside it. */
export interface AccountView {
  account: AccountEntity;
  latest: UsageSnapshot | undefined;
  weeklyPeaks: WeeklyPeak[];
}

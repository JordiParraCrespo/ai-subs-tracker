import type { AccountEntity } from '@flama/frontend-consumer';
import { type AccountPace, paceOf, wastedCents } from '@flama/shared/subscriptions';

/** What the plans cost a month, in US cents. */
export function monthlySpendCents(accounts: readonly AccountEntity[]): number {
  return accounts.reduce((sum, account) => sum + account.monthlyPriceCents, 0);
}

/** The allowance that expired unused in the last month's weekly resets, priced. */
export function wastedLastMonthCents(accounts: readonly AccountEntity[]): number {
  return accounts.reduce(
    (sum, account) => sum + wastedCents(account.weeklyPeaks, account.monthlyPriceCents),
    0,
  );
}

export type AttentionKind = 'signin' | 'expiring' | 'limit' | 'behind';

export interface AttentionItem {
  account: AccountEntity;
  pace: AccountPace;
  kind: AttentionKind;
}

const ORDER: Record<AttentionKind, number> = { signin: 0, expiring: 1, behind: 2, limit: 3 };

/**
 * What deserves a look: a login that stopped reporting, headroom about to
 * expire, an account well behind an even pace, one at its limit.
 */
export function attentionItems(accounts: readonly AccountEntity[], now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const account of accounts) {
    const pace = paceOf(account, now);
    const status = account.status;
    if (status === 'auth_expired' || status === 'no_credentials' || status === 'error') {
      items.push({ account, pace, kind: 'signin' });
    } else if (pace.status === 'expiring') items.push({ account, pace, kind: 'expiring' });
    else if (pace.status === 'behind') items.push({ account, pace, kind: 'behind' });
    else if (pace.status === 'limit') items.push({ account, pace, kind: 'limit' });
  }
  return items.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}

/** Accounts by their next weekly reset, soonest first. */
export function upcomingResets(accounts: readonly AccountEntity[], now: Date): AccountPace[] {
  return accounts
    .map((account) => paceOf(account, now))
    .filter((pace) => pace.weeklyResetsAt !== null)
    .sort((a, b) => (a.hoursToReset ?? 0) - (b.hoursToReset ?? 0));
}

import type { AccountEntity } from '@flama/frontend-consumer';
import { type AccountPace, type ProviderId, paceOf } from '@flama/shared/subscriptions';

/** The status column: the design's Active, review wash, or the red limit pill. */
export type SubscriptionStatus = 'active' | 'review' | 'limit' | 'signin';

export function subscriptionStatus(account: AccountEntity, pace: AccountPace): SubscriptionStatus {
  if (
    account.status === 'auth_expired' ||
    account.status === 'no_credentials' ||
    account.status === 'error'
  ) {
    return 'signin';
  }
  if (pace.status === 'limit') return 'limit';
  if (pace.status === 'behind' || pace.status === 'expiring') return 'review';
  return 'active';
}

export const STATUS_FILTERS = ['all', 'active', 'review', 'limit'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const SORTS = ['cost', 'reset', 'left', 'name'] as const;
export type SubscriptionSort = (typeof SORTS)[number];

export interface SubscriptionsQuery {
  q?: string;
  status?: StatusFilter;
  provider?: ProviderId;
  sort?: SubscriptionSort;
  page?: number;
}

export interface SubscriptionRow {
  account: AccountEntity;
  pace: AccountPace;
  status: SubscriptionStatus;
}

/** The rows the toolbar asks for, in its order. The list is the person's own, served whole. */
export function subscriptionRows(
  accounts: readonly AccountEntity[],
  query: SubscriptionsQuery,
  now: Date,
): SubscriptionRow[] {
  const needle = query.q?.trim().toLowerCase() ?? '';
  const rows = accounts
    .map((account) => {
      const pace = paceOf(account, now);
      return { account, pace, status: subscriptionStatus(account, pace) };
    })
    .filter(({ account, status }) => {
      if (query.provider && account.provider !== query.provider) return false;
      if (query.status && query.status !== 'all') {
        if (
          query.status === 'review'
            ? status !== 'review' && status !== 'signin'
            : status !== query.status
        ) {
          return false;
        }
      }
      if (!needle) return true;
      return [account.displayName, account.email, account.planName, account.provider]
        .filter(Boolean)
        .some((text) => text?.toLowerCase().includes(needle));
    });
  const sort = query.sort ?? 'cost';
  return rows.sort((a, b) => {
    if (sort === 'name') return a.account.displayName.localeCompare(b.account.displayName);
    if (sort === 'left') return (b.pace.left ?? -1) - (a.pace.left ?? -1);
    if (sort === 'reset') return (a.pace.hoursToReset ?? 1e9) - (b.pace.hoursToReset ?? 1e9);
    return b.account.monthlyPriceCents - a.account.monthlyPriceCents;
  });
}

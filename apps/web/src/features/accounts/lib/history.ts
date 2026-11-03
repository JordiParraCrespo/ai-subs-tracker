import type { AccountEntity } from '@flama/frontend-consumer';

/**
 * What the plans cost in each of the last `months` months, oldest first: an
 * account counts from the month it was first tracked. US cents.
 */
export function monthlySpendHistory(
  accounts: readonly AccountEntity[],
  now: Date,
  months = 12,
): { month: Date; cents: number }[] {
  return Array.from({ length: months }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const cents = accounts
      .filter((account) => account.createdAt < end)
      .reduce((sum, account) => sum + account.monthlyPriceCents, 0);
    return { month, cents };
  });
}

import { AccountEntity } from '@flama/frontend-consumer';
import type { ProviderId } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { unscheduled, upcomingRenewals } from '../lib/renewals';

const NOW = new Date('2026-11-19T12:00:00');

interface Shape {
  id: string;
  provider?: ProviderId;
  planId?: string | null;
  priceCents?: number;
  priceOverridden?: boolean;
  renewalDay?: number | null;
}

function account(shape: Shape): AccountEntity {
  return new AccountEntity(
    shape.id,
    shape.provider ?? 'grok',
    `ext-${shape.id}`,
    shape.id,
    null,
    null,
    null,
    null,
    null,
    null,
    shape.planId ?? null,
    null,
    false,
    shape.priceCents ?? 0,
    shape.priceOverridden ?? false,
    shape.renewalDay ?? null,
    false,
    null,
    false,
    null,
    new Date('2026-11-17T00:00:00Z'),
    null,
    [],
  );
}

describe('unscheduled', () => {
  // Regression: a Grok login whose tier the catalog did not know had no plan,
  // a price of 0 and no reported day, so it showed nowhere on Renewals.
  it('lists an account with no plan and no day, so it asks for its day', () => {
    const grok = account({ id: 'grok', planId: null, priceCents: 0 });
    expect(unscheduled([grok]).map((a) => a.id)).toEqual(['grok']);
  });

  it('lists a paid plan with no day, and leaves out a known free plan', () => {
    const paid = account({ id: 'paid', planId: 'grok-super', priceCents: 10_000 });
    const free = account({ id: 'free', planId: 'grok-free', priceCents: 0 });
    expect(unscheduled([paid, free]).map((a) => a.id)).toEqual(['paid']);
  });

  it('lists a known plan with no published price until the person says what they pay', () => {
    // Z.AI Pro is a catalog plan with no published price.
    const unpriced = account({ id: 'x', provider: 'zai', planId: 'zai-pro', priceCents: 0 });
    const setFree = account({
      id: 'set',
      provider: 'zai',
      planId: 'zai-pro',
      priceCents: 0,
      priceOverridden: true,
    });
    expect(unscheduled([unpriced, setFree]).map((a) => a.id)).toEqual(['x']);
  });

  it('leaves out an account that has a day: the calendar shows it', () => {
    const scheduled = account({ id: 'day', planId: null, renewalDay: 25 });
    expect(unscheduled([scheduled])).toEqual([]);
    expect(upcomingRenewals([scheduled], NOW).map((u) => u.account.id)).toEqual(['day']);
  });
});

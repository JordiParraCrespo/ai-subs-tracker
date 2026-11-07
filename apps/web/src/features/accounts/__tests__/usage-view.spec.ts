import { AccountEntity } from '@flama/frontend-consumer';
import type { ProviderId } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { filtersOf, groupUsage, listedAccounts, type UsageRow } from '../lib/usage-view';

function account(id: string, provider: ProviderId, email: string): AccountEntity {
  return new AccountEntity(
    id,
    provider,
    `ext-${id}`,
    email,
    null,
    null,
    email,
    null,
    null,
    null,
    null,
    null,
    false,
    20_000,
    false,
    null,
    false,
    null,
    false,
    null,
    new Date('2026-11-01T00:00:00Z'),
    null,
    [],
  );
}

const row = (accountId: string, cost: number): UsageRow => ({
  accountId,
  day: '2026-11-05',
  model: 'claude-opus',
  input: 100,
  output: 10,
  cacheWrite: 0,
  cacheRead: 0,
  messages: 1,
  apiCostCents: cost,
});

/**
 * Grouped by account, the table built its rows from token records only, so
 * an account added later that had not used anything yet vanished from it
 * while the value card above still listed it.
 */
describe('groupUsage by account', () => {
  const accounts = [
    account('a', 'claude-code', 'hi@work.ai'),
    account('b', 'codex', 'me@gmail.com'),
    account('c', 'claude-code', 'me@gmail.com'),
  ];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows = [row('a', 7_000), row('b', 10)];

  it('lists an account with no usage at zero, after the ones that used something', () => {
    const listed = listedAccounts(accounts, filtersOf({}));
    const grouped = groupUsage(rows, byId, new Map(), 'account', listed);
    expect(grouped.map((g) => [g.key, g.cost, g.messages])).toEqual([
      ['a', 7_000, 1],
      ['b', 10, 1],
      ['c', 0, 0],
    ]);
  });

  it('keeps the filters: a provider filter or a search leaves out the accounts they exclude', () => {
    expect(listedAccounts(accounts, filtersOf({ provider: 'codex' })).map((a) => a.id)).toEqual([
      'b',
    ]);
    expect(listedAccounts(accounts, filtersOf({ q: 'gmail' })).map((a) => a.id)).toEqual([
      'b',
      'c',
    ]);
  });
});

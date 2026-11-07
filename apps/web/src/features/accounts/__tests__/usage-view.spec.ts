import { AccountEntity } from '@flama/frontend-consumer';
import type { ProviderId } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { filterUsage, groupUsage, type UsageRow } from '../lib/usage-view';

function account(id: string, provider: ProviderId): AccountEntity {
  return new AccountEntity(
    id,
    provider,
    `ext-${id}`,
    `${id}@example.com`,
    null,
    null,
    `${id}@example.com`,
    null,
    null,
    null,
    null,
    null,
    false,
    0,
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

function row(accountId: string, model: string, apiCostCents: number): UsageRow {
  return {
    accountId,
    day: '2026-11-01',
    model,
    input: 100,
    output: 10,
    cacheWrite: 0,
    cacheRead: 0,
    messages: 1,
    apiCostCents,
  } as UsageRow;
}

const accounts = new Map([
  ['a1', account('a1', 'claude-code')],
  ['a2', account('a2', 'claude-code')],
  ['o1', account('o1', 'codex')],
]);
const labels = new Map<string, string>();
const rows = [
  row('a1', 'claude-opus', 7_000),
  row('a2', 'claude-sonnet', 300),
  row('o1', 'gpt-5-codex', 11),
];

/**
 * Grouped by provider, the usage table named the products (Claude Code,
 * Codex), which the subscription rows above it already show; a provider is the
 * company that is paid.
 */
describe('groupUsage by provider', () => {
  it('names each row after the company and adds up its products', () => {
    const grouped = groupUsage(rows, accounts, labels, 'provider');
    expect(grouped.map((g) => [g.name, g.products, g.spans, g.cost])).toEqual([
      ['Anthropic', ['claude-code'], 2, 7_300],
      ['OpenAI', ['codex'], 1, 11],
    ]);
  });

  it('finds a product by its company name', () => {
    const found = filterUsage(rows, accounts, labels, {
      provider: 'all',
      accountId: '',
      q: 'openai',
    });
    expect(found.map((r) => r.accountId)).toEqual(['o1']);
  });
});

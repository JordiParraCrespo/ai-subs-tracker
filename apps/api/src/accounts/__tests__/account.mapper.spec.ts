import { describe, expect, it } from 'vitest';
import { AccountMapper } from '../account.mapper';

const row = (accountId: string, day: string, model: string, input: number) => ({
  accountId,
  day,
  model,
  input,
  output: input / 10,
  cacheWrite: 0,
  cacheRead: input * 2,
  messages: 3,
});

describe('AccountMapper.toUsageSummary', () => {
  // The usage screen filters and groups these rows itself; if a row went
  // unpriced or one went missing, its totals would disagree with the headline.
  it('returns every account, day and model priced, adding up to the totals', () => {
    const summary = new AccountMapper().toUsageSummary(
      [
        row('a', '2026-11-01', 'claude-sonnet-5-5', 2_000_000),
        row('a', '2026-11-02', 'gpt-6.1-sol-codex', 1_000_000),
        row('b', '2026-11-02', 'claude-sonnet-5-5', 500_000),
      ],
      30,
      '2026-10-04',
    );

    expect(summary.rows.map((r) => [r.accountId, r.day, r.model])).toEqual([
      ['a', '2026-11-01', 'claude-sonnet-5-5'],
      ['a', '2026-11-02', 'gpt-6.1-sol-codex'],
      ['b', '2026-11-02', 'claude-sonnet-5-5'],
    ]);
    expect(summary.rows.every((r) => r.apiCostCents > 0)).toBe(true);
    const sum = summary.rows.reduce((total, r) => total + r.apiCostCents, 0);
    expect(sum).toBeCloseTo(summary.totals.apiCostCents, 0);
    expect(summary.rows.reduce((total, r) => total + r.input, 0)).toBe(summary.totals.input);
  });
});

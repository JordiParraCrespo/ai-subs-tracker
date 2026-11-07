import type { LimitWindow, UsageSnapshot } from '@flama/shared/schemas/accounts';
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

describe('AccountMapper: hand-tracked accounts', () => {
  const mapper = new AccountMapper();

  it('makes a create request’s absent fields explicit, and carries nothing else', () => {
    expect(
      mapper.toManualAccountInput('user-1', { provider: 'zai', label: 'GLM', planId: 'zai-lite' }),
    ).toEqual({
      userId: 'user-1',
      provider: 'zai',
      label: 'GLM',
      email: null,
      planId: 'zai-lite',
      monthlyPriceCents: null,
      renewalDay: null,
    });
  });

  it('reads the weekly reset as an instant, and leaves an unknown one unknown', () => {
    const usage = { sessionUtilization: 10, weeklyUtilization: null };
    expect(mapper.toManualUsage({ ...usage, weeklyResetsAt: '2026-11-09T08:00:00+01:00' })).toEqual(
      { ...usage, weeklyResetsAt: new Date('2026-11-09T07:00:00Z') },
    );
    expect(mapper.toManualUsage({ ...usage, weeklyResetsAt: null }).weeklyResetsAt).toBeNull();
  });
});

describe('AccountMapper.toUnofficialSnapshot', () => {
  // Regression: a desktop clock running ahead filed readings in the future,
  // where they would outrank every later one as "latest".
  it('pins the source and stamps the reading when it arrived, not when the desktop says', () => {
    const at = new Date('2026-11-05T12:00:00.000Z');
    const stored = new AccountMapper().toUnofficialSnapshot(
      {
        capturedAt: '2099-01-01T00:00:00.000Z',
        source: 'unofficial',
        status: 'ok',
        message: null,
        windows: [],
        extraUsage: null,
      },
      at,
    );
    expect(stored).toMatchObject({ source: 'unofficial', capturedAt: at.toISOString() });
  });
});

describe('AccountMapper.carryStaleWindows', () => {
  const NOW = new Date('2026-11-07T12:00:00.000Z');
  const window = (key: string, resetsAt: string | null): LimitWindow => ({
    key,
    kind: 'weekly',
    label: key,
    utilization: 42,
    resetsAt,
    windowMinutes: 10_080,
  });
  const snapshot = (status: UsageSnapshot['status'], windows: LimitWindow[]): UsageSnapshot => ({
    capturedAt: NOW.toISOString(),
    source: 'poll',
    status,
    message: status === 'auth_stale' ? 'updates the next time Claude runs' : null,
    windows,
    extraUsage: null,
  });

  it('keeps the latest reading when it already has windows', () => {
    const latest = snapshot('ok', [window('seven_day', null)]);
    const previous = snapshot('ok', [window('old', null)]);
    expect(new AccountMapper().carryStaleWindows(latest, previous, NOW)).toBe(latest);
  });

  it('carries the previous windows onto a stale reading, dropping ones already reset', () => {
    const latest = snapshot('auth_stale', []);
    const previous = snapshot('ok', [
      window('future', '2026-11-10T00:00:00.000Z'),
      window('past', '2026-11-01T00:00:00.000Z'),
      window('no-reset', null),
    ]);
    const merged = new AccountMapper().carryStaleWindows(latest, previous, NOW);
    // The stale status and message stay; only the still-live windows come through.
    expect(merged.status).toBe('auth_stale');
    expect(merged.message).toBe('updates the next time Claude runs');
    expect(merged.windows.map((w) => w.key)).toEqual(['future', 'no-reset']);
  });

  it('leaves the empty reading when there is nothing to carry forward', () => {
    const latest = snapshot('auth_stale', []);
    expect(new AccountMapper().carryStaleWindows(latest, undefined, NOW)).toBe(latest);
    const allExpired = snapshot('ok', [window('past', '2026-11-01T00:00:00.000Z')]);
    expect(new AccountMapper().carryStaleWindows(latest, allExpired, NOW)).toBe(latest);
  });
});

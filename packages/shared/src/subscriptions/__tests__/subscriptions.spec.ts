import { describe, expect, it } from 'vitest';
import type { LimitWindow } from '../../schemas/accounts.schema';
import { apiCostCents, priceFor } from '../model-prices';
import { findPlan, resolvePlan } from '../plans';
import { paceOf, rankAccounts, wastedCents } from '../tokenmaxx';

const NOW = new Date('2026-11-02T12:00:00Z');
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

function weekly(utilization: number, resetsInHours: number): LimitWindow {
  return {
    key: 'seven_day',
    kind: 'weekly',
    label: 'Weekly',
    utilization,
    resetsAt: inHours(resetsInHours),
    windowMinutes: 7 * 24 * 60,
  };
}

function session(utilization: number): LimitWindow {
  return {
    key: 'five_hour',
    kind: 'session',
    label: 'Session',
    utilization,
    resetsAt: inHours(2),
    windowMinutes: 300,
  };
}

describe('resolvePlan', () => {
  // The 2026-10-30 rename: a login still reporting the old tier name must land on Ultra,
  // or every Max 20x subscriber is priced as a $100 Max.
  it('maps the retired Max 20x names onto Ultra', () => {
    expect(resolvePlan('claude-code', 'default_claude_max_20x')?.id).toBe('claude-ultra');
    expect(resolvePlan('claude-code', 'Max 20x')?.id).toBe('claude-ultra');
    expect(resolvePlan('claude-code', 'ultra')?.id).toBe('claude-ultra');
  });

  it('keeps Max as the $100 plan', () => {
    expect(resolvePlan('claude-code', 'max')).toMatchObject({
      id: 'claude-max',
      monthlyPriceCents: 10000,
    });
  });

  it('resolves names per provider, so Codex "pro" is not Claude Pro', () => {
    expect(resolvePlan('codex', 'pro')?.id).toBe('codex-pro-200');
    expect(resolvePlan('claude-code', 'pro')?.id).toBe('claude-pro');
  });

  it('answers undefined for a tier it has never heard of', () => {
    expect(resolvePlan('codex', 'galaxy')).toBeUndefined();
    expect(findPlan('nope')).toBeUndefined();
  });
});

describe('apiCostCents', () => {
  it('prices dated model ids by family', () => {
    expect(priceFor('claude-sonnet-5-5-20260901')?.label).toBe('Claude Sonnet 5.5');
    // 1M input + 1M output on Sonnet 5.5 is $2 + $10.
    expect(
      apiCostCents('claude-sonnet-5-5', { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0 }),
    ).toBeCloseTo(1200);
  });

  // A missing rule falls through to the family's (Opus 4.8 read "Claude Opus 4").
  it.each([
    ['claude-opus-5-5', 'Claude Opus 5.5'],
    ['claude-fable-5-2', 'Claude Fable 5.2'],
    ['claude-fable-5-1', 'Claude Fable 5.1'],
    ['claude-mythos-5-1', 'Claude Mythos 5.1'],
    ['claude-sonnet-5-5', 'Claude Sonnet 5.5'],
    ['claude-haiku-5-5', 'Claude Haiku 5.5'],
    ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5'],
    ['claude-sonnet-5', 'Claude Sonnet 5'],
    ['claude-opus-5', 'Claude Opus 5'],
    ['claude-fable-5', 'Claude Fable 5'],
    ['claude-mythos-5', 'Claude Mythos 5'],
    ['claude-opus-4-8', 'Claude Opus 4.8'],
    ['claude-opus-4-8[1m]', 'Claude Opus 4.8'],
    ['claude-opus-4-7', 'Claude Opus 4.7'],
    ['claude-opus-4-6', 'Claude Opus 4.6'],
    ['claude-opus-4-5-20251101', 'Claude Opus 4.5'],
    ['claude-opus-4-1-20250805', 'Claude Opus 4.1'],
    ['claude-opus-4-20250514', 'Claude Opus 4'],
    ['claude-sonnet-4-6', 'Claude Sonnet 4.6'],
    ['claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5'],
    ['claude-sonnet-4-20250514', 'Claude Sonnet 4'],
  ])('names %s as %s', (model, label) => {
    expect(priceFor(model)?.label).toBe(label);
  });

  it('prices Opus 4.8 at its own rate, not at Opus 4 rates', () => {
    const tokens = { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0 };
    // $5 + $25 on Opus 4.8; $15 + $75 on Opus 4.
    expect(apiCostCents('claude-opus-4-8', tokens)).toBeCloseTo(3000);
    expect(apiCostCents('claude-opus-4-20250514', tokens)).toBeCloseTo(9000);
  });

  it('prices Fable 5.2 at its own rate, not at Fable 5 rates', () => {
    const tokens = { input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite: 0 };
    // $8 + $40 + $0.20 on Fable 5.2; $10 + $50 + $1 on Fable 5.
    expect(apiCostCents('claude-fable-5-2', tokens)).toBeCloseTo(4820);
    expect(apiCostCents('claude-fable-5', tokens)).toBeCloseTo(6100);
  });

  it('does not guess a price for an unknown model', () => {
    expect(apiCostCents('mystery-1', { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(
      0,
    );
  });
});

describe('rankAccounts', () => {
  it('picks the account whose headroom expires soonest, not just the emptiest', () => {
    const ranking = rankAccounts(
      [
        { id: 'roomy-late', status: 'ok', windows: [weekly(10, 150)] },
        { id: 'expiring', status: 'ok', windows: [weekly(40, 10)] },
      ],
      NOW,
    );
    expect(ranking.pick?.id).toBe('expiring');
    expect(ranking.reason).toBe('expiring_soon');
  });

  it('never picks an account at its session limit or with a dead login', () => {
    const ranking = rankAccounts(
      [
        { id: 'session-full', status: 'ok', windows: [weekly(5, 20), session(100)] },
        { id: 'expired', status: 'auth_expired', windows: [weekly(0, 5)] },
        { id: 'fine', status: 'ok', windows: [weekly(60, 100)] },
      ],
      NOW,
    );
    expect(ranking.pick?.id).toBe('fine');
    expect(ranking.reason).toBe('only_available');
    expect(ranking.queue.map((p) => p.id).at(0)).toBe('fine');
  });

  it('has no pick when nothing is usable', () => {
    expect(rankAccounts([{ id: 'a', status: 'error', windows: [] }], NOW)).toMatchObject({
      pick: null,
      reason: null,
    });
  });
});

describe('paceOf', () => {
  it('marks an account behind when it is well under an even pace', () => {
    // Half the week gone, 10% used.
    const pace = paceOf({ id: 'a', status: 'ok', windows: [weekly(10, 84)] }, NOW);
    expect(pace.onPaceMark).toBeCloseTo(50);
    expect(pace.status).toBe('behind');
    expect(pace.neededPerDay).toBeCloseTo(90 / 3.5);
  });

  it('treats an Ultra-style plan with no session window as usable', () => {
    const pace = paceOf({ id: 'a', status: 'ok', windows: [weekly(50, 84)] }, NOW);
    expect(pace.sessionUsed).toBeNull();
    expect(pace.usable).toBe(true);
  });
});

describe('wastedCents', () => {
  it('prices the unused share of each closed week', () => {
    // A $100/month plan left half of one week unused.
    expect(wastedCents([{ peakUtilization: 50 }], 10000)).toBeCloseTo((10000 * 7) / 30.44 / 2);
    expect(wastedCents([{ peakUtilization: 120 }], 10000)).toBe(0);
  });
});

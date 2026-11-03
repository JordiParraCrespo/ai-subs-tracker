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

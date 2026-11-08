import { describe, expect, it } from 'vitest';
import { LOCAL_PROVIDER_IDS, plansFor, providerTracking, resolvePlan } from '../plans';

describe('Grok Build plans', () => {
  it('is read on the machine like Claude Code and Codex, not tracked by hand', () => {
    expect(LOCAL_PROVIDER_IDS).toContain('grok');
    expect(providerTracking('grok')).toBe('local');
  });

  it('prices the X Subscription tiers and meters one weekly pool', () => {
    expect(plansFor('grok').map((p) => [p.id, p.monthlyPriceCents, p.multiplier ?? null])).toEqual([
      ['grok-free', 0, null],
      ['grok-plus', 800, 1],
      ['grok-premium', 3000, 4],
      ['grok-super', 10000, 15],
      ['grok-ultra', 20000, 50],
      ['grok-supergrok', 3000, null],
      ['grok-supergrok-heavy', 30000, null],
    ]);
    expect(plansFor('grok').every((p) => p.windows === 'weekly')).toBe(true);
  });

  it("resolves the tier slugs Grok Build's billing view reports", () => {
    expect(resolvePlan('grok', 'supergrok')?.id).toBe('grok-supergrok');
    expect(resolvePlan('grok', 'SuperGrok Heavy')?.id).toBe('grok-supergrok-heavy');
    expect(resolvePlan('grok', 'x_basic')?.id).toBe('grok-free');
    // A slug ResetOwl does not know yet is a new tier, not a guess.
    expect(resolvePlan('grok', 'supergrok_lite')).toBeUndefined();
  });
});

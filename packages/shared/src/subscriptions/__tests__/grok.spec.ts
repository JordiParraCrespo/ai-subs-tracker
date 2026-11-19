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
      // No longer on xAI's pricing pages: no price is published, none is guessed.
      ['grok-supergrok-plus', null, null],
      ['grok-supergrok-lite', null, null],
      ['grok-supergrok-heavy', 30000, null],
      // Sold by X at prices that vary: never a guessed number.
      ['grok-x-premium', null, null],
      ['grok-x-premium-plus', null, null],
    ]);
    expect(plansFor('grok').every((p) => p.windows === 'weekly')).toBe(true);
  });

  it("resolves the tier slugs Grok Build's billing view reports", () => {
    expect(resolvePlan('grok', 'supergrok')?.id).toBe('grok-supergrok');
    expect(resolvePlan('grok', 'SuperGrok Heavy')?.id).toBe('grok-supergrok-heavy');
    expect(resolvePlan('grok', 'x_basic')?.id).toBe('grok-free');
    expect(resolvePlan('grok', 'supergrok_lite')?.id).toBe('grok-supergrok-lite');
    expect(resolvePlan('grok', 'x_premium')?.id).toBe('grok-x-premium');
    expect(resolvePlan('grok', 'x_premium_plus')?.id).toBe('grok-x-premium-plus');
    // A slug ResetOwl does not know yet is a new tier, not a guess.
    expect(resolvePlan('grok', 'supergrok_mega')).toBeUndefined();
  });

  // Regression: the CLI settings name the plan `SuperGrok Plus`, which the
  // catalog lacked, so the account had no plan, no price, and left Renewals.
  it('resolves SuperGrok Plus by the display name the CLI settings give and by its slug', () => {
    expect(resolvePlan('grok', 'SuperGrok Plus')?.id).toBe('grok-supergrok-plus');
    expect(resolvePlan('grok', 'supergrok_plus')?.id).toBe('grok-supergrok-plus');
    expect(resolvePlan('grok', 'X Premium+')?.id).toBe('grok-x-premium-plus');
    // Plus (the X Subscription tier) stays its own plan.
    expect(resolvePlan('grok', 'plus')?.id).toBe('grok-plus');
  });
});

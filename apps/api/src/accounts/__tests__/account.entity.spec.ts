import { describe, expect, it } from 'vitest';
import { AccountEntity } from '../domain/account.entity';

function account(reportedPlan: string | null = 'default_claude_max_20x') {
  return AccountEntity.register('acc-1', {
    userId: 'user-1',
    provider: 'claude-code',
    externalId: 'uuid-at-anthropic',
    email: 'me@example.com',
    organization: null,
    reportedPlan,
    location: '~/.claude',
    at: new Date('2026-11-01T00:00:00Z'),
  });
}

describe('AccountEntity', () => {
  it('prices a login from the plan the provider reports, including renamed tiers', () => {
    const entity = account();
    expect(entity.plan?.id).toBe('claude-ultra');
    expect(entity.effectivePriceCents).toBe(20000);
  });

  it('lets the owner override the plan and the price', () => {
    const entity = account();
    entity.edit({ planId: 'claude-max', monthlyPriceCents: 9000 });
    expect(entity.plan?.id).toBe('claude-max');
    expect(entity.effectivePriceCents).toBe(9000);
    entity.edit({ monthlyPriceCents: null });
    expect(entity.effectivePriceCents).toBe(10000);
  });

  // A Codex plan on a Claude login would price it wrongly and silently.
  it('refuses a plan from another provider', () => {
    expect(() => account().edit({ planId: 'codex-plus' })).toThrow();
  });

  it('keeps the last known identity when a sync omits a field', () => {
    const entity = account();
    entity.recordSighting({
      email: null,
      organization: 'Acme',
      reportedPlan: null,
      location: null,
      at: new Date('2026-11-02T00:00:00Z'),
    });
    expect(entity.email).toBe('me@example.com');
    expect(entity.reportedPlan).toBe('default_claude_max_20x');
    expect(entity.organization).toBe('Acme');
    expect(entity.lastSyncedAt?.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('shows the label, else the email', () => {
    const entity = account();
    expect(entity.displayName).toBe('me@example.com');
    entity.edit({ label: 'Work' });
    expect(entity.displayName).toBe('Work');
  });

  it('is no longer active once archived', () => {
    const entity = account();
    entity.activate(new Date());
    entity.archive(new Date());
    expect(entity.isActive).toBe(false);
    expect(entity.isArchived).toBe(true);
  });
});

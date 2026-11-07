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
    reportedRenewal: null,
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
  // Renewals draws a plan on this day of every month; a 0 or a 32 would put
  // it on no day at all, or roll it into the next month.
  it('takes a renewal day of the month and refuses one outside 1 to 31', () => {
    const entity = account();
    entity.edit({ renewalDay: 14 });
    expect(entity.renewalDay).toBe(14);
    expect(() => account().edit({ renewalDay: 0 })).toThrow();
    expect(() => account().edit({ renewalDay: 32 })).toThrow();
    expect(() => account().edit({ renewalDay: 2.5 })).toThrow();
    entity.edit({ renewalDay: null });
    expect(entity.renewalDay).toBeNull();
  });

  // Codex's token carries the end of the paid period, so its billing day
  // arrives with a sync. The person's own day must win, clearing theirs must
  // fall back to the reported one, and a sync whose token says nothing must
  // not wipe a day already known.
  it('takes the billing day a login reports, under the one the person sets', () => {
    const entity = account();
    const sighting = (reportedRenewal: { day: number; checkedAt: Date | null } | null) =>
      entity.recordSighting({
        email: null,
        organization: null,
        reportedPlan: null,
        location: null,
        reportedRenewal,
        at: new Date('2026-11-06T00:00:00Z'),
      });
    sighting({ day: 23, checkedAt: new Date('2026-09-22T10:09:48Z') });
    expect(entity.renewalDay).toBe(23);
    expect(entity.renewalDayOverridden).toBe(false);
    expect(entity.renewalCheckedAt?.toISOString()).toBe('2026-09-22T10:09:48.000Z');

    entity.edit({ renewalDay: 5 });
    sighting({ day: 24, checkedAt: new Date('2026-10-22T10:00:00Z') });
    expect(entity.renewalDay).toBe(5);
    expect(entity.renewalDayOverridden).toBe(true);

    entity.edit({ renewalDay: null });
    sighting(null);
    expect(entity.renewalDay).toBe(24);
    expect(entity.renewalDayOverridden).toBe(false);
  });

  // One login syncs from every machine that holds it, each with a token
  // issued at a different time: an older token must not bring back a day
  // the provider has since replaced.
  it('keeps the billing day the provider confirmed last, whichever machine syncs', () => {
    const entity = account();
    const sighting = (day: number, checkedAt: string | null) =>
      entity.recordSighting({
        email: null,
        organization: null,
        reportedPlan: null,
        location: null,
        reportedRenewal: { day, checkedAt: checkedAt ? new Date(checkedAt) : null },
        at: new Date('2026-11-06T00:00:00Z'),
      });
    sighting(23, '2026-11-02T10:00:00Z');
    sighting(12, '2026-09-22T10:00:00Z');
    expect(entity.renewalDay).toBe(23);
    // A token that names no check cannot say it is newer either.
    sighting(12, null);
    expect(entity.renewalDay).toBe(23);
    expect(entity.renewalCheckedAt?.toISOString()).toBe('2026-11-02T10:00:00.000Z');
    sighting(12, '2026-12-02T10:00:00Z');
    expect(entity.renewalDay).toBe(12);
  });

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
      reportedRenewal: null,
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

  it('belongs to its owner until someone else is named, and back again', () => {
    const entity = account();
    expect(entity.person).toBeNull();
    entity.edit({ person: 'Ana' });
    expect(entity.person).toBe('Ana');
    entity.edit({ label: 'Work' });
    expect(entity.person).toBe('Ana');
    entity.edit({ person: null });
    expect(entity.person).toBeNull();
  });

  it('is no longer active once archived', () => {
    const entity = account();
    entity.activate(new Date());
    entity.archive(new Date());
    expect(entity.isActive).toBe(false);
    expect(entity.isArchived).toBe(true);
  });
});

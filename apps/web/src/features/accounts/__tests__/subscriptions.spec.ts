import { AccountEntity, type UsageReading } from '@flama/frontend-consumer';
import type { LimitWindow, SnapshotStatus } from '@flama/shared/schemas/accounts';
import { paceOf } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { attentionItems } from '../lib/insights';
import { subscriptionStatus } from '../lib/subscriptions';

const NOW = new Date('2026-11-07T12:00:00Z');

function reading(status: SnapshotStatus, windows: LimitWindow[]): UsageReading {
  return { capturedAt: NOW, source: 'poll', status, message: null, windows, extraUsage: null };
}

function account(latest: UsageReading | null): AccountEntity {
  return new AccountEntity(
    'id-1',
    'claude-code',
    'ext-1',
    'me@work.dev',
    null,
    null,
    'me@work.dev',
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
    latest,
    [],
  );
}

// ~57% of the week has elapsed by NOW (resets in 3 of 7 days), so a reading
// near that reads on-pace rather than behind or ahead.
const weekly: LimitWindow = {
  key: 'seven_day',
  kind: 'weekly',
  label: 'Weekly',
  utilization: 55,
  resetsAt: '2026-11-10T00:00:00Z',
  windowMinutes: 10_080,
};

/**
 * A renewable-but-stale login is marked `stale`, not `signin`: its token
 * refreshes the next time Claude runs and its last good reading still shows.
 * A truly signed-out login is still `signin`.
 */
describe('subscriptionStatus', () => {
  it('marks a renewable-but-stale login stale, keeping the carried-forward reading', () => {
    const acc = account(reading('auth_stale', [weekly]));
    expect(subscriptionStatus(acc, paceOf(acc, NOW))).toBe('stale');
  });

  it('still asks a truly signed-out login to sign in', () => {
    const acc = account(reading('auth_expired', []));
    expect(subscriptionStatus(acc, paceOf(acc, NOW))).toBe('signin');
  });

  it('never asks for a sign-in when only the reading failed (a rejected request, the network)', () => {
    const acc = account(reading('error', []));
    expect(subscriptionStatus(acc, paceOf(acc, NOW))).toBe('unreadable');
  });

  it('reads a healthy login by its pace', () => {
    const acc = account(reading('ok', [weekly]));
    expect(subscriptionStatus(acc, paceOf(acc, NOW))).toBe('active');
  });
});

function zaiAccount(planId: string, reportedPlan: string | null): AccountEntity {
  return new AccountEntity(
    'zai-1',
    'zai',
    'zai-1',
    'Side project',
    'Side project',
    null,
    null,
    null,
    null,
    reportedPlan,
    planId,
    'Lite',
    true,
    1_800,
    false,
    null,
    false,
    null,
    false,
    null,
    new Date('2026-11-01T00:00:00Z'),
    reading('ok', [weekly]),
    [],
  );
}

/**
 * Regression: a Max subscriber who left the add form on Lite was tracked
 * against Lite's credits with nothing on screen saying the vendor disagreed.
 */
describe('a hand-tracked plan its vendor reports as another tier', () => {
  it('needs review instead of reading active', () => {
    const acc = zaiAccount('zai-lite', 'max');
    expect(subscriptionStatus(acc, paceOf(acc, NOW))).toBe('review');
  });

  it('is a "needs attention" item of its own', () => {
    expect(attentionItems([zaiAccount('zai-lite', 'max')], NOW).map((i) => i.kind)).toEqual([
      'plan',
    ]);
  });

  it('stays active when the reported tier is the chosen one', () => {
    const acc = zaiAccount('zai-max', 'max');
    expect(subscriptionStatus(acc, paceOf(acc, NOW))).toBe('active');
    expect(attentionItems([acc], NOW)).toEqual([]);
  });
});

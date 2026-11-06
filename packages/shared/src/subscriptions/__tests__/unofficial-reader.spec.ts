import { describe, expect, it } from 'vitest';
import {
  createAccountSchema,
  reportUsageReadingSchema,
  usageReaderKeyFormSchema,
} from '../../schemas/accounts.schema';
import {
  isManualProvider,
  LOCAL_PROVIDER_IDS,
  plansFor,
  resolvePlan,
  UNOFFICIAL_USAGE_READERS,
  unofficialUsageReader,
} from '../plans';
import { paceOf } from '../tokenmaxx';

describe('BigModel Coding Plan catalog', () => {
  // docs.bigmodel.cn/cn/coding-plan/overview states credits per window and no
  // price: any number here would be invented.
  it('holds the three documented tiers, with no price', () => {
    expect(
      plansFor('bigmodel').map((p) => [
        p.id,
        p.allowance?.session,
        p.allowance?.weekly,
        p.monthlyPriceCents,
      ]),
    ).toEqual([
      ['bigmodel-lite', 2000, 10000, null],
      ['bigmodel-pro', 12000, 60000, null],
      ['bigmodel-max', 28000, 140000, null],
    ]);
  });

  it('is tracked by hand, and its tiers resolve apart from Z.AI’s', () => {
    expect(isManualProvider('bigmodel')).toBe(true);
    expect(LOCAL_PROVIDER_IDS).not.toContain('bigmodel');
    expect(resolvePlan('bigmodel', 'pro')?.id).toBe('bigmodel-pro');
    expect(resolvePlan('zai', 'pro')?.id).toBe('zai-pro');
  });

  it('needs the price paid for every tier', () => {
    const base = { provider: 'bigmodel', label: 'CN', planId: 'bigmodel-lite' } as const;
    expect(createAccountSchema.safeParse(base).success).toBe(false);
    expect(createAccountSchema.safeParse({ ...base, monthlyPriceCents: 1700 }).success).toBe(true);
    expect(createAccountSchema.safeParse({ ...base, planId: 'zai-lite' }).success).toBe(false);
  });
});

describe('unofficial usage readers', () => {
  // The key goes to this origin: anything but the vendor's own HTTPS site
  // would hand a person's key to someone else.
  it('reads each GLM plan from its own vendor, over HTTPS, and nothing else', () => {
    expect(UNOFFICIAL_USAGE_READERS.zai?.origin).toBe('https://api.z.ai');
    expect(UNOFFICIAL_USAGE_READERS.bigmodel?.origin).toBe('https://open.bigmodel.cn');
    expect(unofficialUsageReader('codex')).toBeUndefined();
    expect(unofficialUsageReader('claude-code')).toBeUndefined();
  });

  const window = {
    key: 'weekly',
    kind: 'weekly' as const,
    label: 'Weekly',
    utilization: 40,
    resetsAt: '2026-11-09T08:00:00.000Z',
    windowMinutes: 10080,
  };
  const snapshot = {
    capturedAt: '2026-11-05T12:00:00.000Z',
    source: 'unofficial' as const,
    status: 'ok' as const,
    message: null,
    windows: [window],
    extraUsage: null,
  };

  it('takes only an unofficial, successful reading with windows, and drops a stray key', () => {
    expect(reportUsageReadingSchema.safeParse({ reportedPlan: 'pro', snapshot }).success).toBe(
      true,
    );
    for (const bad of [
      { ...snapshot, source: 'poll' },
      { ...snapshot, status: 'error' },
      { ...snapshot, windows: [] },
    ]) {
      expect(
        reportUsageReadingSchema.safeParse({ reportedPlan: null, snapshot: bad }).success,
      ).toBe(false);
    }
    const parsed = reportUsageReadingSchema.parse({ reportedPlan: null, snapshot, apiKey: 'k' });
    expect(parsed).not.toHaveProperty('apiKey');
  });

  it('takes a pasted key as one printable line', () => {
    expect(usageReaderKeyFormSchema.safeParse({ apiKey: ' abcd1234.ef ' }).success).toBe(true);
    expect(usageReaderKeyFormSchema.safeParse({ apiKey: 'abcd 1234' }).success).toBe(false);
    expect(usageReaderKeyFormSchema.safeParse({ apiKey: 'short' }).success).toBe(false);
  });

  // Regression guard: an unofficial reading stops arriving when the desktop
  // app closes or the endpoint changes. It must lapse like one typed by hand,
  // not stay "live" forever as a collected one would.
  it('lets an unofficial reading lapse once its window resets', () => {
    const account = {
      id: 'a',
      status: 'ok' as const,
      reading: { source: 'unofficial' as const, capturedAt: snapshot.capturedAt },
      windows: [window],
    };
    expect(paceOf(account, new Date('2026-11-06T00:00:00Z')).weeklyUsed).toBe(40);
    expect(paceOf(account, new Date('2026-11-10T00:00:00Z')).weeklyUsed).toBeNull();
  });
});

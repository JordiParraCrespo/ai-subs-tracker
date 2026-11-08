import { describe, expect, it } from 'vitest';
import {
  createAccountSchema,
  recordUsageFormSchema,
  recordUsageSchema,
  syncAccountSchema,
} from '../../schemas/accounts.schema';
import {
  isManualProvider,
  LOCAL_PROVIDER_IDS,
  PROVIDER_IDS,
  plansFor,
  reportedPlanMismatch,
  resolvePlan,
  UNOFFICIAL_USAGE_READERS,
} from '../plans';
import { paceOf } from '../tokenmaxx';

describe('Z.AI Coding Plan catalog', () => {
  // Regression: Z.AI documents credits per window (docs.z.ai/devpack/overview);
  // a typo here mis-states what every Z.AI subscriber is paying for.
  it('holds the three documented tiers with their credit allowances', () => {
    expect(
      plansFor('zai').map((plan) => [plan.id, plan.allowance?.session, plan.allowance?.weekly]),
    ).toEqual([
      ['zai-lite', 2000, 10000],
      ['zai-pro', 12000, 60000],
      ['zai-max', 28000, 140000],
    ]);
  });

  // Only Lite's price is published; a number for Pro or Max would be invented.
  it('prices only Lite and leaves the unpublished tiers to the person', () => {
    expect(plansFor('zai').map((plan) => plan.monthlyPriceCents)).toEqual([1800, null, null]);
  });

  it('resolves Z.AI names without colliding with Claude or Codex tiers', () => {
    expect(resolvePlan('zai', 'pro')?.id).toBe('zai-pro');
    expect(resolvePlan('zai', 'max')?.id).toBe('zai-max');
    expect(resolvePlan('claude-code', 'max')?.id).toBe('claude-max');
  });

  it('is tracked by hand, and never by the desktop collector', () => {
    expect(PROVIDER_IDS).toContain('zai');
    expect(isManualProvider('zai')).toBe(true);
    expect(isManualProvider('claude-code')).toBe(false);
    expect(LOCAL_PROVIDER_IDS).not.toContain('zai');
  });
});

describe('createAccountSchema', () => {
  const base = { provider: 'zai', label: 'Side project', planId: 'zai-lite' } as const;

  it('accepts a Lite subscription at its list price', () => {
    expect(createAccountSchema.safeParse(base).success).toBe(true);
  });

  it('requires a price for a tier without a published one', () => {
    const missing = createAccountSchema.safeParse({ ...base, planId: 'zai-pro' });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['monthlyPriceCents']);
    expect(
      createAccountSchema.safeParse({ ...base, planId: 'zai-pro', monthlyPriceCents: 7200 })
        .success,
    ).toBe(true);
  });

  it('refuses another provider’s plan', () => {
    expect(createAccountSchema.safeParse({ ...base, planId: 'claude-pro' }).success).toBe(false);
  });

  // Claude Code and Codex accounts come from the machine; a hand-made one
  // would never match a login and would double-count the plan.
  it('refuses a provider the desktop collector reads', () => {
    expect(
      createAccountSchema.safeParse({ ...base, provider: 'codex', planId: 'codex-plus' }).success,
    ).toBe(false);
  });

  // The schema has no field for a key: an extra one is stripped, not stored.
  it('drops anything that is not a field, such as an API key', () => {
    const parsed = createAccountSchema.parse({ ...base, apiKey: 'not-a-real-key' });
    expect(parsed).not.toHaveProperty('apiKey');
  });
});

describe('syncAccountSchema', () => {
  it('refuses a Z.AI account arriving by sync', () => {
    const account = {
      provider: 'zai',
      externalId: 'x',
      email: null,
      organization: null,
      reportedPlan: null,
      location: null,
      snapshot: null,
      dailyTokens: [],
    };
    expect(syncAccountSchema.safeParse(account).success).toBe(false);
    expect(syncAccountSchema.safeParse({ ...account, provider: 'codex' }).success).toBe(true);
  });
});

describe('recordUsageSchema', () => {
  it('needs at least one window', () => {
    expect(
      recordUsageSchema.safeParse({
        sessionUtilization: null,
        weeklyUtilization: null,
        weeklyResetsAt: null,
      }).success,
    ).toBe(false);
  });

  it('caps a percentage at 100', () => {
    expect(
      recordUsageSchema.safeParse({
        sessionUtilization: null,
        weeklyUtilization: 101,
        weeklyResetsAt: null,
      }).success,
    ).toBe(false);
  });

  it('takes the form’s typed values', () => {
    expect(
      recordUsageFormSchema.safeParse({ session: '', weekly: '42.5', weeklyResetsAt: '' }).success,
    ).toBe(true);
    expect(
      recordUsageFormSchema.safeParse({ session: '', weekly: '', weeklyResetsAt: '' }).success,
    ).toBe(false);
    expect(
      recordUsageFormSchema.safeParse({ session: '100', weekly: '', weeklyResetsAt: 'tomorrow' })
        .success,
    ).toBe(false);
  });
});

describe('a hand-recorded reading over time', () => {
  const RECORDED = new Date('2026-11-04T10:00:00Z');
  const hoursLater = (h: number) => new Date(RECORDED.getTime() + h * 3_600_000);
  const manual = (weeklyResetsAt: string | null) => ({
    id: 'zai',
    status: 'ok' as const,
    reading: { source: 'manual' as const, capturedAt: RECORDED.toISOString() },
    windows: [
      {
        key: 'five_hour',
        kind: 'session' as const,
        label: '5-hour',
        utilization: 100,
        resetsAt: hoursLater(5).toISOString(),
        windowMinutes: 300,
      },
      {
        key: 'weekly',
        kind: 'weekly' as const,
        label: 'Weekly',
        utilization: 40,
        resetsAt: weeklyResetsAt,
        windowMinutes: 10080,
      },
    ],
  });

  // Regression: no sync ever replaces a manual reading, so a full 5-hour
  // window kept the account "at limit" forever, and a weekly reading past its
  // reset stayed the most urgent pick days later.
  it('forgets a 5-hour reading once its credits have come back', () => {
    const account = manual(hoursLater(48).toISOString());
    expect(paceOf(account, hoursLater(1))).toMatchObject({ sessionUsed: 100, status: 'limit' });
    expect(paceOf(account, hoursLater(6))).toMatchObject({ sessionUsed: null, weeklyUsed: 40 });
  });

  it('treats the week as unknown once it has reset', () => {
    const account = manual(hoursLater(24).toISOString());
    expect(paceOf(account, hoursLater(30))).toMatchObject({
      weeklyUsed: null,
      status: 'unknown',
      usable: false,
    });
  });

  it('lets a weekly reading with no reset given last at most a week', () => {
    const account = manual(null);
    expect(paceOf(account, hoursLater(24)).weeklyUsed).toBe(40);
    expect(paceOf(account, hoursLater(24 * 7 + 1)).weeklyUsed).toBeNull();
  });

  it('leaves a collected reading as it is: the next sync replaces it', () => {
    const account = { ...manual(hoursLater(24).toISOString()), reading: null };
    expect(paceOf(account, hoursLater(30)).weeklyUsed).toBe(40);
  });
});

describe('a reported Z.AI tier that differs from the chosen plan', () => {
  // Regression: the add form starts on Lite, so a Max subscriber who leaves it
  // there is tracked against Lite's credits until something says otherwise.
  it('names the tier the vendor reports when the person chose another', () => {
    expect(reportedPlanMismatch('zai', 'zai-lite', 'max')?.id).toBe('zai-max');
    expect(reportedPlanMismatch('bigmodel', 'bigmodel-pro', 'LITE')?.id).toBe('bigmodel-lite');
  });

  it('says nothing when they agree, nothing was reported, or the tier is unknown', () => {
    expect(reportedPlanMismatch('zai', 'zai-max', 'max')).toBeUndefined();
    expect(reportedPlanMismatch('zai', 'zai-max', null)).toBeUndefined();
    expect(reportedPlanMismatch('zai', 'zai-max', 'enterprise')).toBeUndefined();
    expect(reportedPlanMismatch('zai', null, 'max')).toBeUndefined();
  });

  // A Claude override is the person's deliberate answer to an ambiguous login name.
  it('leaves local providers alone', () => {
    expect(reportedPlanMismatch('claude-code', 'claude-ultra', 'max')).toBeUndefined();
  });
});

describe('Z.AI usage page', () => {
  // Regression: the link pointed at the billing page, which shows no usage.
  it('opens the Coding Plan usage page', () => {
    expect(UNOFFICIAL_USAGE_READERS.zai?.usageUrl).toBe(
      'https://z.ai/manage-apikey/coding-plan/personal/usage',
    );
  });
});

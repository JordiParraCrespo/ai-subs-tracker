import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { syncAccountSchema } from '@flama/shared/schemas/accounts';
import { resolvePlan } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { grokProvider } from '../grok';
import { parseGrokAuth } from '../grok/auth';
import { parseGrokBilling } from '../grok/billing';
import type { DetectedLogin } from '../types';
import { fakeFetch, NOW, SINCE, tempHome, testEnv, writeJson } from './helpers';

const opts = { sinceDay: SINCE, fetchLimits: true };

const SESSION = {
  key: 'grok-session',
  user_id: 'user-1',
  email: 'dev@example.com',
  team_id: 'team-1',
  expires_at: '2026-11-08T12:00:00Z',
};

async function grokHome(
  auth: Record<string, unknown> = { 'https://accounts.x.ai/sign-in': SESSION },
) {
  const home = await tempHome();
  const dir = join(home, '.grok');
  await writeJson(join(dir, 'auth.json'), auth);
  const login: DetectedLogin = { provider: 'grok', home: dir, isDefault: true, managed: false };
  return { home, dir, login };
}

const BILLING = {
  config: {
    creditUsagePercent: 37.5,
    subscriptionTier: 'supergrok_heavy',
    currentPeriod: {
      type: 'USAGE_PERIOD_TYPE_WEEKLY',
      start: '2026-10-30T00:00:00Z',
      end: '2026-11-06T00:00:00Z',
    },
  },
};

describe('grok detect', () => {
  it('finds ~/.grok and managed homes, skipping a folder with no login', async () => {
    const { home, dir } = await grokHome();
    await writeJson(join(home, 'managed', 'grok', 'g1', 'auth.json'), {
      'https://accounts.x.ai/sign-in': SESSION,
    });
    await mkdir(join(home, 'managed', 'grok', 'empty'), { recursive: true });
    expect(await grokProvider.detect(testEnv(home))).toEqual([
      { provider: 'grok', home: dir, isDefault: true, managed: false },
      {
        provider: 'grok',
        home: join(home, 'managed', 'grok', 'g1'),
        isDefault: false,
        managed: true,
      },
    ]);
  });

  it('uses $GROK_HOME as the default home', async () => {
    const home = await tempHome();
    const custom = join(home, 'grok-custom');
    await writeJson(join(custom, 'auth.json'), { 'https://accounts.x.ai/sign-in': SESSION });
    const found = await grokProvider.detect(testEnv(home, { env: { GROK_HOME: custom } }));
    expect(found.map((l) => [l.home, l.isDefault])).toEqual([[custom, true]]);
  });
});

describe('grok auth', () => {
  it("prefers xAI's own sign-in over another issuer in the same file", () => {
    const auth = parseGrokAuth({
      'https://idp.example.com': { key: 'other', email: 'sso@example.com' },
      'https://accounts.x.ai/sign-in': SESSION,
    });
    expect(auth).toMatchObject({ accessToken: 'grok-session', userId: 'user-1' });
  });

  it('treats a logged-out file, whose entries have no key, as no login', () => {
    expect(parseGrokAuth({ 'https://accounts.x.ai/sign-in': { email: 'a@b.c' } })).toBeNull();
  });
});

describe('grok billing parsing', () => {
  it('reads the weekly pool, its reset and the tier', () => {
    expect(parseGrokBilling(BILLING)).toEqual({
      tier: 'supergrok_heavy',
      windows: [
        {
          key: 'weekly',
          kind: 'weekly',
          label: 'Weekly',
          utilization: 37.5,
          resetsAt: '2026-11-06T00:00:00.000Z',
          windowMinutes: 10080,
        },
      ],
    });
    expect(resolvePlan('grok', 'supergrok_heavy')?.id).toBe('grok-supergrok-heavy');
  });

  it("falls back to a unified-billing account's monthly budget, never both", () => {
    const parsed = parseGrokBilling({
      monthlyLimit: { val: '200' },
      used: { val: '50' },
      billingPeriodEnd: '2026-12-01T00:00:00Z',
    });
    expect(parsed.windows.map((w) => [w.kind, w.utilization])).toEqual([['monthly', 25]]);
    const both = parseGrokBilling({
      ...BILLING.config,
      monthlyLimit: { val: 200 },
      used: { val: 1 },
    });
    expect(both.windows.map((w) => w.kind)).toEqual(['weekly']);
  });

  it('reports no window for a response with no usage in it', () => {
    expect(parseGrokBilling({ config: {} }).windows).toEqual([]);
    expect(parseGrokBilling('nope')).toEqual({ tier: null, windows: [] });
  });
});

describe('grok read', () => {
  it('asks the CLI billing view with the session token and an honest User-Agent', async () => {
    const { home, dir, login } = await grokHome();
    const { fn, calls } = fakeFetch(BILLING);
    const account = await grokProvider.read(login, testEnv(home, { fetch: fn }), opts);
    expect(calls[0]?.url).toBe('https://cli-chat-proxy.grok.com/v1/billing?format=credits');
    expect(calls[0]?.headers).toMatchObject({
      Authorization: 'Bearer grok-session',
      'X-XAI-Token-Auth': 'xai-grok-cli',
      'User-Agent': 'resetowl-desktop/test',
    });
    expect(account).toMatchObject({
      provider: 'grok',
      externalId: 'user-1',
      email: 'dev@example.com',
      reportedPlan: 'supergrok_heavy',
      location: dir,
      dailyTokens: [],
      snapshot: { status: 'ok' },
    });
    expect(syncAccountSchema.safeParse(account).success).toBe(true);
    // The token never leaves for anywhere but xAI, and never into the account.
    expect(JSON.stringify(account)).not.toContain('grok-session');
  });

  it('says to run grok once when the session has lapsed, without asking xAI', async () => {
    const { home, login } = await grokHome({
      'https://accounts.x.ai/sign-in': { ...SESSION, expires_at: '2026-11-01T00:00:00Z' },
    });
    const { fn, calls } = fakeFetch(BILLING);
    const account = await grokProvider.read(login, testEnv(home, { fetch: fn }), opts);
    expect(calls).toHaveLength(0);
    expect(account.snapshot).toMatchObject({ status: 'auth_expired' });
    expect(account.snapshot?.message).toContain('`grok`');
  });

  it('maps a rejected token and rate limiting to their statuses', async () => {
    const { home, login } = await grokHome();
    const rejected = await grokProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch({}, 401).fn }),
      opts,
    );
    expect(rejected.snapshot?.status).toBe('auth_expired');
    const limited = await grokProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch({}, 429).fn }),
      opts,
    );
    expect(limited.snapshot?.status).toBe('rate_limited');
  });

  it('makes no request with fetchLimits off', async () => {
    const { home, login } = await grokHome();
    const { fn, calls } = fakeFetch(BILLING);
    const account = await grokProvider.read(login, testEnv(home, { fetch: fn }), {
      ...opts,
      fetchLimits: false,
    });
    expect(calls).toHaveLength(0);
    expect(account.snapshot).toBeNull();
    expect(NOW.getTime()).toBeLessThan(Date.parse(SESSION.expires_at));
  });

  it('signs a new account in by device code into an isolated GROK_HOME', async () => {
    expect(grokProvider.loginCommand('/m/grok/g2')).toEqual({
      command: 'grok',
      args: ['login', '--device-auth'],
      env: { GROK_HOME: '/m/grok/g2' },
      linkHosts: ['accounts.x.ai', 'auth.x.ai'],
    });
    const { dir, login } = await grokHome();
    expect(await grokProvider.signedInAs(dir)).toBe('user-1');
    expect(grokProvider.launchEnv(login)).toEqual({});
    expect(grokProvider.launchEnv({ ...login, isDefault: false })).toEqual({ GROK_HOME: dir });
  });
});

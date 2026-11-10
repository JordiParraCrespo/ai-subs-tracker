import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { syncAccountSchema } from '@flama/shared/schemas/accounts';
import { resolvePlan } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { grokProvider } from '../grok';
import { parseGrokAuth } from '../grok/auth';
import { billingConfig, monthlyWindow, weeklyWindow } from '../grok/billing';
import type { DetectedLogin } from '../types';
import { type FetchCall, fakeFetch, NOW, SINCE, tempHome, testEnv, writeJson } from './helpers';

const opts = { sinceDay: SINCE, fetchLimits: true };

const SESSION = {
  key: 'grok-session',
  user_id: 'user-1',
  email: 'dev@example.com',
  team_id: 'team-1',
  expires_at: '2026-11-08T12:00:00Z',
};

async function grokHome(auth: Record<string, unknown> = { 'https://auth.x.ai::cli': SESSION }) {
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
      'https://auth.x.ai': SESSION,
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

/** A fetch answering each URL from `routes` (unknown URLs 404) and recording each call. */
function routedFetch(routes: Record<string, { body: unknown; status?: number }>) {
  const calls: FetchCall[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    const route = routes[String(url)];
    return new Response(JSON.stringify(route?.body ?? {}), {
      status: route ? (route.status ?? 200) : 404,
    });
  }) as typeof fetch;
  return { fn, calls };
}

describe('grok auth', () => {
  it('reads the default xAI issuer over an alternate one in the same file', () => {
    const auth = parseGrokAuth(
      {
        'https://idp.example.com': { key: 'other', email: 'sso@example.com' },
        'https://auth.x.ai::cli': SESSION,
      },
      NOW,
    );
    expect(auth).toMatchObject({ accessToken: 'grok-session', userId: 'user-1' });
  });

  it('skips a lapsed default entry when a fresh one follows it', () => {
    const auth = parseGrokAuth(
      {
        'https://auth.x.ai::old': { ...SESSION, key: 'old', expires_at: '2026-11-01T00:00:00Z' },
        'https://auth.x.ai::new': SESSION,
      },
      NOW,
    );
    expect(auth?.accessToken).toBe('grok-session');
  });

  it('counts a session within five minutes of its expiry as lapsed', () => {
    const soon = new Date(NOW.getTime() + 4 * 60_000).toISOString();
    const auth = parseGrokAuth({ 'https://auth.x.ai': { ...SESSION, expires_at: soon } }, NOW);
    expect(auth?.accessToken).toBe('grok-session');
    // Lapsed, but still the session to read with: the CLI renews it.
    const later = parseGrokAuth(
      {
        'https://auth.x.ai::a': { ...SESSION, key: 'lapsing', expires_at: soon },
        'https://auth.x.ai::b': SESSION,
      },
      NOW,
    );
    expect(later?.accessToken).toBe('grok-session');
  });

  it('uses an alternate issuer only when the file has no default xAI entry', () => {
    const alternate = { 'https://accounts.x.ai/sign-in': SESSION };
    expect(parseGrokAuth(alternate, NOW)?.accessToken).toBe('grok-session');
    // A tokenless default entry (after `grok logout`) does not bring it back.
    expect(
      parseGrokAuth({ ...alternate, 'https://auth.x.ai::cli': { user_id: 'gone' } }, NOW),
    ).toBeNull();
  });

  it('treats a logged-out file, whose entries have no key, as no login', () => {
    expect(parseGrokAuth({ 'https://auth.x.ai': { email: 'a@b.c' } }, NOW)).toBeNull();
  });
});

describe('grok billing parsing', () => {
  it('reads the weekly pool and its reset', () => {
    const config = billingConfig(BILLING);
    expect(config && weeklyWindow(config)).toEqual({
      key: 'weekly',
      kind: 'weekly',
      label: 'Weekly',
      utilization: 37.5,
      resetsAt: '2026-11-06T00:00:00.000Z',
      windowMinutes: 10080,
    });
    expect(resolvePlan('grok', 'supergrok_heavy')?.id).toBe('grok-supergrok-heavy');
  });

  it("reads a flat unified-billing account's monthly budget, never as a weekly zero", () => {
    const flat = {
      monthlyLimit: { val: '200' },
      used: { val: '50' },
      billingPeriodEnd: '2026-12-01T00:00:00Z',
    };
    const config = billingConfig(flat);
    expect(config && weeklyWindow(config)).toBeNull();
    expect(config && monthlyWindow(config)?.utilization).toBe(25);
  });

  it('reads a confirmed weekly period with no percentage as zero used', () => {
    const config = {
      currentPeriod: {
        type: 'USAGE_PERIOD_TYPE_WEEKLY',
        start: '2026-10-30T00:00:00Z',
        end: '2026-11-06T00:00:00Z',
      },
      billingPeriodStart: '2026-10-30T00:00:00Z',
      billingPeriodEnd: '2026-11-06T00:00:00Z',
    };
    expect(weeklyWindow(config)?.utilization).toBe(0);
    // A zero spend scalar means usage is unreported, not zero.
    expect(weeklyWindow({ ...config, used: { val: 0 } })).toBeNull();
  });

  it('finds no config in a response with none', () => {
    expect(billingConfig({ other: 1 })).toBeNull();
  });
});

describe('grok read', () => {
  it('asks the CLI billing view with the session token and user id, as Orca does', async () => {
    const { home, dir, login } = await grokHome();
    const { fn, calls } = fakeFetch(BILLING);
    const account = await grokProvider.read(login, testEnv(home, { fetch: fn }), opts);
    expect(calls[0]?.url).toBe('https://cli-chat-proxy.grok.com/v1/billing?format=credits');
    expect(calls[0]?.headers).toMatchObject({
      Authorization: 'Bearer grok-session',
      'X-XAI-Token-Auth': 'xai-grok-cli',
      'x-userid': 'user-1',
    });
    // The HTTP client's own User-Agent goes, not one of ResetOwl's.
    expect(calls[0]?.headers).not.toHaveProperty('User-Agent');
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
      'https://auth.x.ai': { ...SESSION, expires_at: '2026-11-01T00:00:00Z' },
    });
    const { fn, calls } = fakeFetch(BILLING);
    const account = await grokProvider.read(login, testEnv(home, { fetch: fn }), opts);
    expect(calls).toHaveLength(0);
    // Stale, not signed out: the CLI renews it, so the screens never ask for a sign-in.
    expect(account.snapshot).toMatchObject({ status: 'auth_stale' });
    expect(account.snapshot?.message).toContain('`grok`');
  });

  it('asks the default billing view for a monthly budget the credits view lacks', async () => {
    const { home, login } = await grokHome();
    const { fn, calls } = routedFetch({
      'https://cli-chat-proxy.grok.com/v1/billing?format=credits': {
        body: { config: { subscriptionTier: 'supergrok' } },
      },
      'https://cli-chat-proxy.grok.com/v1/billing': {
        body: { config: { monthlyLimit: { val: 100 }, used: { val: 40 } } },
      },
    });
    const account = await grokProvider.read(login, testEnv(home, { fetch: fn }), opts);
    expect(calls.map((c) => c.url)).toEqual([
      'https://cli-chat-proxy.grok.com/v1/billing?format=credits',
      'https://cli-chat-proxy.grok.com/v1/billing',
    ]);
    expect(account.reportedPlan).toBe('supergrok');
    expect(account.snapshot?.windows.map((w) => [w.kind, w.utilization])).toEqual([
      ['monthly', 40],
    ]);
  });

  it('reports a rejected session as an error, never as a sign-out', async () => {
    const { home, login } = await grokHome();
    for (const status of [401, 403]) {
      const rejected = await grokProvider.read(
        login,
        testEnv(home, { fetch: fakeFetch({}, status).fn }),
        opts,
      );
      expect(rejected.snapshot).toMatchObject({
        status: 'error',
        message: `Grok usage request unauthorized (HTTP ${status}).`,
      });
    }
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

  it('signs a new account in through the browser, or by device code for another device', async () => {
    expect(grokProvider.loginCommand('/m/grok/g2')).toEqual({
      command: 'grok',
      args: ['login'],
      env: { GROK_HOME: '/m/grok/g2' },
      linkHosts: ['accounts.x.ai', 'auth.x.ai'],
    });
    expect(grokProvider.loginCommand('/m/grok/g2', { deviceCode: true }).args).toEqual([
      'login',
      '--device-auth',
    ]);
    const { dir, login } = await grokHome();
    expect(await grokProvider.signedInAs(dir)).toBe('user-1');
    expect(grokProvider.launchEnv(login)).toEqual({});
    expect(grokProvider.launchEnv({ ...login, isDefault: false })).toEqual({ GROK_HOME: dir });
  });
});

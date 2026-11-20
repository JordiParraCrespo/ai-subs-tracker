import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { syncAccountSchema } from '@flama/shared/schemas/accounts';
import { resolvePlan } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { grokProvider } from '../grok';
import { parseGrokAuth } from '../grok/auth';
import { billingConfig, billingTier, monthlyWindow, weeklyWindow } from '../grok/billing';
import { GROK_ACP_ARGS, GROK_RENEW_PROMPT } from '../grok/renew';
import type { DetectedLogin } from '../types';
import {
  type FetchCall,
  fakeFetch,
  fakeGrok,
  NOW,
  SINCE,
  tempHome,
  testEnv,
  writeJson,
} from './helpers';

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

const CREDITS_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits';

/** `/billing?format=credits` as xAI answered it to Grok CLI 1.0.89 (2026-11-19): no tier. */
const CAPTURED_CREDITS = {
  config: {
    currentPeriod: {
      type: 'USAGE_PERIOD_TYPE_WEEKLY',
      start: '2026-11-15T16:53:55.022+00:00',
      end: '2026-11-22T16:53:55.022+00:00',
    },
    creditUsagePercent: 21,
    productUsage: [{ product: 'GrokTasks', usagePercent: 21 }],
    isUnifiedBillingUser: true,
    prepaidBalance: { val: 0 },
    topUpMethod: 'TOP_UP_METHOD_SAVED_PAYMENT_METHOD',
    billingPeriodStart: '2026-11-15T16:53:55.022+00:00',
    billingPeriodEnd: '2026-11-22T16:53:55.022+00:00',
  },
};

/** `/billing` from the same capture: the calendar month, no tier. */
const CAPTURED_DEFAULT = {
  config: {
    monthlyLimit: { val: 0 },
    used: { val: 0 },
    onDemandCap: { val: 0 },
    billingPeriodStart: '2026-11-01T00:00:00+00:00',
    billingPeriodEnd: '2026-12-01T00:00:00+00:00',
    history: [
      {
        billingCycle: { year: 2026, month: 10 },
        includedUsed: { val: 0 },
        onDemandUsed: { val: 0 },
        totalUsed: { val: 0 },
      },
    ],
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

  it('finds no tier in either billing view xAI answers today', () => {
    for (const data of [CAPTURED_CREDITS, CAPTURED_DEFAULT]) {
      const config = billingConfig(data);
      expect(config && billingTier(config, data)).toBeNull();
    }
    // The default view's zero budget is no monthly window.
    const fallback = billingConfig(CAPTURED_DEFAULT);
    expect(fallback && monthlyWindow(fallback)).toBeNull();
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
      'https://auth.x.ai': { ...SESSION, expires_at: '2026-11-02T06:00:00Z' },
    });
    const { fn, calls } = fakeFetch(BILLING);
    const account = await grokProvider.read(login, testEnv(home, { fetch: fn }), opts);
    expect(calls).toHaveLength(0);
    // Stale, not signed out: the CLI renews it, so the screens never ask for a sign-in.
    expect(account.snapshot).toMatchObject({ status: 'auth_stale' });
    expect(account.snapshot?.message).toContain('`grok`');
  });

  // Regression (#42): a session nobody renewed stayed "Out of date" for good,
  // with nothing on the screens to sign it in again.
  it('asks for a sign-in once the session has been lapsed for more than a day', async () => {
    const { home, login } = await grokHome({
      'https://auth.x.ai::cli': { ...SESSION, expires_at: '2026-11-01T11:00:00Z' },
    });
    const { fn, calls } = fakeFetch(BILLING);
    const account = await grokProvider.read(login, testEnv(home, { fetch: fn }), opts);
    expect(calls).toHaveLength(0);
    expect(account.snapshot).toMatchObject({ status: 'auth_expired' });
    expect(account.snapshot?.message).toContain('`grok login`');
    // Identity still reads, so the account keeps its row and its history.
    expect(account).toMatchObject({ email: 'dev@example.com' });
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

  // Regression: xAI's billing views name no tier for a unified X Subscription
  // account, so the reading is ok with no plan; Renewals then asks for its
  // day and the person picks the tier. Nothing else is asked of xAI.
  it('reads the captured credits view: the weekly pool, no tier, no renewal day', async () => {
    const { home, login } = await grokHome();
    const { fn, calls } = routedFetch({ [CREDITS_URL]: { body: CAPTURED_CREDITS } });
    const account = await grokProvider.read(login, testEnv(home, { fetch: fn }), opts);
    expect(calls.map((c) => c.url)).toEqual([CREDITS_URL]);
    expect(account.reportedPlan).toBeNull();
    expect(account.reportedRenewal).toBeNull();
    expect(account.snapshot).toMatchObject({ status: 'ok', message: null });
    expect(account.snapshot?.windows).toEqual([
      {
        key: 'weekly',
        kind: 'weekly',
        label: 'Weekly',
        utilization: 21,
        resetsAt: '2026-11-22T16:53:55.022Z',
        windowMinutes: 10080,
      },
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

describe('grok renewal, run as Orca runs Grok with no window', () => {
  /** Lapsed for a day and a half: what used to ask for a sign-in every day. */
  const LAPSED = { ...SESSION, expires_at: '2026-11-01T00:00:00Z' };
  const RENEWED = { ...SESSION, key: 'grok-renewed', expires_at: '2026-11-03T12:00:00Z' };

  // Regression: a Grok session lapsed for more than a day read as "sign in
  // again" every morning, although Grok Build could renew it on its own.
  it('lets the CLI renew a lapsed session over ACP, then reads usage with the new one', async () => {
    const { home, dir, login } = await grokHome({ 'https://auth.x.ai': LAPSED });
    const grok = fakeGrok({
      onAuthenticate: () => writeJson(join(dir, 'auth.json'), { 'https://auth.x.ai': RENEWED }),
    });
    const { fn, calls } = fakeFetch(BILLING);
    const account = await grokProvider.read(
      login,
      testEnv(home, { fetch: fn, spawnCli: grok.spawnCli }),
      opts,
    );
    expect(account.snapshot).toMatchObject({ status: 'ok' });
    expect(calls[0]?.headers.Authorization).toBe('Bearer grok-renewed');
    // Orca's ACP launch, pointed at this login, and only the saved sign-in.
    expect(grok.calls).toEqual([
      {
        command: 'grok',
        args: GROK_ACP_ARGS,
        env: { GROK_HOME: dir, GROK_STORAGE_MODE: 'local' },
      },
    ]);
    expect(grok.rpc.map((r) => r.method)).toEqual(['initialize', 'authenticate']);
    expect(grok.rpc[1]?.params).toEqual({ methodId: 'cached_token' });
  });

  it("runs Orca's headless prompt when signing in alone leaves the session lapsed", async () => {
    const { home, dir, login } = await grokHome({ 'https://auth.x.ai': LAPSED });
    let prompt = '';
    const grok = fakeGrok({
      onTask: async (file) => {
        prompt = await readFile(file, 'utf8');
        await writeJson(join(dir, 'auth.json'), { 'https://auth.x.ai': RENEWED });
      },
    });
    const account = await grokProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch(BILLING).fn, spawnCli: grok.spawnCli }),
      opts,
    );
    expect(account.snapshot).toMatchObject({ status: 'ok' });
    expect(prompt).toBe(GROK_RENEW_PROMPT);
    const task = grok.calls[1]?.args ?? [];
    expect(task).toEqual(
      expect.arrayContaining(['--tools', 'Read,Grep,Glob', '--deny', 'Bash,Edit,Write']),
    );
    expect(grok.calls[1]?.env).toEqual({ GROK_HOME: dir, GROK_STORAGE_MODE: 'local' });
  });

  it('keeps a session the CLI renewed even when its prompt then fails', async () => {
    const { home, dir, login } = await grokHome({ 'https://auth.x.ai': LAPSED });
    const grok = fakeGrok({
      onTask: () => writeJson(join(dir, 'auth.json'), { 'https://auth.x.ai': RENEWED }),
      taskExit: 1,
    });
    const account = await grokProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch(BILLING).fn, spawnCli: grok.spawnCli }),
      opts,
    );
    expect(account.snapshot).toMatchObject({ status: 'ok' });
  });

  it('asks for a sign-in when the CLI has no saved login to renew', async () => {
    const { home, login } = await grokHome({
      'https://auth.x.ai': { ...SESSION, expires_at: '2026-11-02T06:00:00Z' },
    });
    const grok = fakeGrok({ authMethods: ['grok.com'] });
    const { fn, calls } = fakeFetch(BILLING);
    const account = await grokProvider.read(
      login,
      testEnv(home, { fetch: fn, spawnCli: grok.spawnCli }),
      opts,
    );
    expect(calls).toHaveLength(0);
    expect(account.snapshot).toMatchObject({ status: 'auth_expired' });
    expect(account.snapshot?.message).toContain('`grok login`');
    expect(grok.rpc.map((r) => r.method)).toEqual(['initialize']);
  });

  it('never signs in with another login than auth.json', async () => {
    const { home, login } = await grokHome({
      'https://auth.x.ai': { ...SESSION, expires_at: '2026-11-02T06:00:00Z' },
    });
    const grok = fakeGrok({
      authMethods: ['cached_token', 'xai.api_key'],
      defaultAuthMethodId: 'xai.api_key',
    });
    const account = await grokProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch(BILLING).fn, spawnCli: grok.spawnCli }),
      opts,
    );
    expect(grok.rpc.map((r) => r.method)).toEqual(['initialize']);
    // Not renewed, not signed out: the stale reading stays.
    expect(account.snapshot).toMatchObject({ status: 'auth_stale' });
  });

  it('keeps the stale reading when grok is not installed', async () => {
    const { home, login } = await grokHome({
      'https://auth.x.ai': { ...SESSION, expires_at: '2026-11-02T06:00:00Z' },
    });
    const grok = fakeGrok({ enoent: true });
    const account = await grokProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch(BILLING).fn, spawnCli: grok.spawnCli }),
      opts,
    );
    expect(account.snapshot).toMatchObject({ status: 'auth_stale' });
  });

  it('starts no CLI for a fresh session', async () => {
    const { home, login } = await grokHome();
    const grok = fakeGrok();
    await grokProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch(BILLING).fn, spawnCli: grok.spawnCli }),
      opts,
    );
    expect(grok.calls).toHaveLength(0);
  });
});

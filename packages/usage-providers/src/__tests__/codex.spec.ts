import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { syncAccountSchema } from '@flama/shared/schemas/accounts';
import { resolvePlan } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { codexProvider, reportedRenewal } from '../codex';
import { CODEX_PROBE_ARGS } from '../codex/app-server';
import { parseCodexAuth, readCodexAuthWithGrace } from '../codex/auth';
import { parseCodexUsage } from '../codex/usage-api';
import { localDay } from '../lib/util';
import type { DetectedLogin } from '../types';
import {
  fakeAppServer,
  fakeFetch,
  fakeJwt,
  jsonl,
  NOW,
  SINCE,
  tempHome,
  testEnv,
  writeJson,
  writeText,
} from './helpers';

const opts = { sinceDay: SINCE, fetchLimits: true };

const ID_TOKEN = fakeJwt({
  email: 'dev@example.com',
  'https://api.openai.com/auth': {
    chatgpt_plan_type: 'pro',
    chatgpt_account_id: 'acct-from-jwt',
  },
});

async function codexHome(tokens: Record<string, unknown> = {}) {
  const home = await tempHome();
  const dir = join(home, '.codex');
  await writeJson(join(dir, 'auth.json'), {
    OPENAI_API_KEY: null,
    tokens: { id_token: ID_TOKEN, access_token: 'codex-access', account_id: 'acct-1', ...tokens },
  });
  const login: DetectedLogin = { provider: 'codex', home: dir, isDefault: true, managed: false };
  return { home, dir, login };
}

const WHAM = {
  plan_type: 'pro',
  rate_limit: {
    primary_window: { used_percent: 42, limit_window_seconds: 18_000, reset_at: 1_793_000_000 },
    secondary_window: { used_percent: 7, limit_window_seconds: 604_800, reset_after_seconds: 3600 },
  },
};

describe('codex detect', () => {
  it('finds ~/.codex and managed homes', async () => {
    const { home, dir } = await codexHome();
    await writeJson(join(home, 'managed', 'codex', 'c1', 'auth.json'), {
      tokens: { access_token: 'c' },
    });
    const found = await codexProvider.detect(testEnv(home));
    expect(found).toEqual([
      { provider: 'codex', home: dir, isDefault: true, managed: false },
      {
        provider: 'codex',
        home: join(home, 'managed', 'codex', 'c1'),
        isDefault: false,
        managed: true,
      },
    ]);
  });

  it('uses $CODEX_HOME as the default home', async () => {
    const home = await tempHome();
    const custom = join(home, 'codex-custom');
    await writeJson(join(custom, 'auth.json'), { tokens: { access_token: 'a' } });
    await writeJson(join(home, '.codex', 'auth.json'), { tokens: { access_token: 'b' } });
    const found = await codexProvider.detect(testEnv(home, { env: { CODEX_HOME: custom } }));
    expect(found.map((l) => [l.home, l.isDefault])).toEqual([[custom, true]]);
  });

  it('skips a managed folder holding no login, which a failed sign-in can leave', async () => {
    const { home, dir } = await codexHome();
    await mkdir(join(home, 'managed', 'codex', 'empty'), { recursive: true });
    const found = await codexProvider.detect(testEnv(home));
    expect(found.map((l) => l.home)).toEqual([dir]);
  });

  it('finds nothing without a Codex home', async () => {
    expect(await codexProvider.detect(testEnv(await tempHome()))).toEqual([]);
  });
});

describe('codex auth', () => {
  it('decodes plan, account and email from the id_token without verifying it', () => {
    const auth = parseCodexAuth({ tokens: { id_token: ID_TOKEN, access_token: 'x' } });
    expect(auth).toEqual({
      mode: 'chatgpt',
      accessToken: 'x',
      accountId: 'acct-from-jwt',
      email: 'dev@example.com',
      planType: 'pro',
      organization: null,
      subscriptionActiveUntil: null,
      subscriptionLastChecked: null,
    });
    expect(resolvePlan('codex', auth?.planType)?.id).toBe('codex-pro-200');
  });

  it('reads the billing day from the end of the paid period, even one already over', () => {
    // Shaped like a real token: issued in September, read in November.
    const token = fakeJwt({
      'https://api.openai.com/auth': {
        chatgpt_plan_type: 'pro',
        chatgpt_subscription_active_start: '2026-03-02T07:36:03+00:00',
        chatgpt_subscription_active_until: '2026-09-23T12:20:15+00:00',
        chatgpt_subscription_last_checked: '2026-09-22T10:09:48.974208+00:00',
      },
    });
    const auth = parseCodexAuth({ tokens: { id_token: token, access_token: 'x' } });
    const renewal = reportedRenewal(auth);
    // The day in this machine's local time; noon UTC is the 23rd in every zone a test runs in.
    expect(renewal).toEqual({ day: 23, checkedAt: '2026-09-22T10:09:48.974Z' });
  });

  it('reports no billing day when the token has no period, or an unreadable one', () => {
    expect(
      reportedRenewal(parseCodexAuth({ tokens: { id_token: ID_TOKEN, access_token: 'x' } })),
    ).toBeNull();
    const garbled = fakeJwt({
      'https://api.openai.com/auth': { chatgpt_subscription_active_until: 'soon' },
    });
    expect(
      reportedRenewal(parseCodexAuth({ tokens: { id_token: garbled, access_token: 'x' } })),
    ).toBeNull();
    expect(reportedRenewal(parseCodexAuth({ OPENAI_API_KEY: 'sk-1', tokens: null }))).toBeNull();
  });

  it('recognises an API-key-only login', () => {
    expect(parseCodexAuth({ OPENAI_API_KEY: 'sk-123', tokens: null })?.mode).toBe('api_key');
  });
});

describe('codex usage parsing', () => {
  it('classifies windows by length and reads both reset formats', () => {
    const parsed = parseCodexUsage(WHAM, NOW);
    expect(parsed.planType).toBe('pro');
    expect(parsed.windows).toEqual([
      {
        key: 'primary',
        kind: 'session',
        label: 'Session (5h)',
        utilization: 42,
        resetsAt: new Date(1_793_000_000_000).toISOString(),
        windowMinutes: 300,
      },
      {
        key: 'secondary',
        kind: 'weekly',
        label: 'Weekly',
        utilization: 7,
        resetsAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
        windowMinutes: 10080,
      },
    ]);
  });

  it('classifies a weekly-only plan whose primary window is the week', () => {
    const parsed = parseCodexUsage(
      {
        plan_type: 'pro',
        rate_limit: { primary_window: { used_percent: 3, limit_window_seconds: 604_800 } },
      },
      NOW,
    );
    expect(parsed.windows.map((w) => [w.key, w.kind])).toEqual([['primary', 'weekly']]);
  });

  it('reads credits as extra usage when present', () => {
    expect(
      parseCodexUsage({ ...WHAM, credits: { has_credits: true, balance: '12' } }, NOW).extraUsage,
    ).toMatchObject({ enabled: true });
  });
});

describe('codex read', () => {
  it("asks Codex's own CLI first, through app-server, in the login's CODEX_HOME", async () => {
    const { home, dir, login } = await codexHome();
    const server = fakeAppServer({
      result: {
        rateLimits: {
          primary: { usedPercent: 30, windowDurationMins: 300, resetsAt: 1_793_000_000 },
          secondary: { usedPercent: 60, windowDurationMins: 10080, resetsAt: 1_793_500_000 },
          credits: { hasCredits: true, balance: '5' },
        },
      },
    });
    const { fn, calls } = fakeFetch(WHAM);
    const account = await codexProvider.read(
      login,
      testEnv(home, { fetch: fn, spawnCli: server.spawnCli }),
      opts,
    );
    expect(server.calls).toEqual([
      { command: 'codex', args: CODEX_PROBE_ARGS, env: { CODEX_HOME: dir } },
    ]);
    // Both windows came from the CLI: wham/usage is not asked.
    expect(calls).toHaveLength(0);
    expect(account.snapshot?.status).toBe('ok');
    expect(account.snapshot?.windows.map((w) => [w.kind, w.utilization])).toEqual([
      ['session', 30],
      ['weekly', 60],
    ]);
    expect(account.snapshot?.extraUsage?.enabled).toBe(true);
    // The plan comes from the login when the CLI does not name it.
    expect(account.reportedPlan).toBe('pro');
  });

  it('fills a session window the CLI left out from wham/usage', async () => {
    const { home, login } = await codexHome();
    const server = fakeAppServer({
      result: { rateLimits: { secondary: { usedPercent: 60, windowDurationMins: 10080 } } },
    });
    const { fn, calls } = fakeFetch(WHAM);
    const account = await codexProvider.read(
      login,
      testEnv(home, { fetch: fn, spawnCli: server.spawnCli }),
      opts,
    );
    expect(calls).toHaveLength(1);
    expect(account.snapshot?.windows.map((w) => w.kind)).toEqual(['session', 'weekly']);
  });

  it('marks the login signed out only when the CLI says it cannot refresh it', async () => {
    const { home, login } = await codexHome();
    const server = fakeAppServer({
      exit: 1,
      stderr: 'Error: refresh token was already used\n',
    });
    const { fn, calls } = fakeFetch(WHAM);
    const account = await codexProvider.read(
      login,
      testEnv(home, { fetch: fn, spawnCli: server.spawnCli }),
      opts,
    );
    expect(calls).toHaveLength(0);
    expect(account.snapshot).toMatchObject({
      status: 'auth_expired',
      message: 'Your ChatGPT session could not be refreshed. Please sign in again.',
    });
  });

  it("falls back to wham/usage with Codex's client headers when the CLI cannot run", async () => {
    const { home, dir, login } = await codexHome();
    const server = fakeAppServer({ enoent: true });
    const { fn, calls } = fakeFetch(WHAM);
    const account = await codexProvider.read(
      login,
      testEnv(home, { fetch: fn, spawnCli: server.spawnCli }),
      opts,
    );
    expect(calls[0]?.url).toBe('https://chatgpt.com/backend-api/wham/usage');
    expect(calls[0]?.headers).toEqual({
      Authorization: 'Bearer codex-access',
      'ChatGPT-Account-Id': 'acct-1',
      'User-Agent': 'codex-cli',
      'OpenAI-Beta': 'codex-1',
      originator: 'Codex Desktop',
    });
    expect(account).toMatchObject({
      provider: 'codex',
      externalId: 'acct-1',
      email: 'dev@example.com',
      reportedPlan: 'pro',
      location: dir,
    });
    expect(account.snapshot?.status).toBe('ok');
    expect(account.snapshot?.windows).toHaveLength(2);
  });

  it('never reads a 401 or 403 from wham/usage as a sign-out', async () => {
    for (const status of [401, 403]) {
      const { home, login } = await codexHome();
      const account = await codexProvider.read(
        login,
        testEnv(home, { fetch: fakeFetch({}, status).fn }),
        opts,
      );
      expect(account.snapshot?.status).toBe('error');
      expect(account.snapshot?.message).toContain(`HTTP ${status}`);
    }
  });

  it('turns a 429 into rate_limited', async () => {
    const { home, login } = await codexHome();
    const account = await codexProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch({}, 429).fn }),
      opts,
    );
    expect(account.snapshot?.status).toBe('rate_limited');
  });

  it('waits out auth.json being rewritten before calling a login gone', async () => {
    const { dir } = await codexHome();
    expect(await readCodexAuthWithGrace(dir, 2_000)).not.toBeNull();
    const authFile = join(dir, 'auth.json');
    const { rename } = await import('node:fs/promises');
    await rename(authFile, `${authFile}.tmp`);
    setTimeout(() => void rename(`${authFile}.tmp`, authFile), 300);
    expect((await readCodexAuthWithGrace(dir, 2_000))?.accountId).toBe('acct-1');
    // A home that never had a login is not waited for.
    const started = Date.now();
    expect(await readCodexAuthWithGrace(join(dir, 'never'), 2_000)).toBeNull();
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('says only a ChatGPT sign-in has plan limits for an API-key login', async () => {
    const home = await tempHome();
    const dir = join(home, '.codex');
    await writeJson(join(dir, 'auth.json'), { OPENAI_API_KEY: 'sk-abc' });
    const { fn, calls } = fakeFetch(WHAM);
    const account = await codexProvider.read(
      { provider: 'codex', home: dir, isDefault: true, managed: false },
      testEnv(home, { fetch: fn }),
      opts,
    );
    expect(calls).toHaveLength(0);
    expect(account.snapshot?.status).toBe('no_credentials');
    expect(account.snapshot?.message).toMatch(/ChatGPT sign-in/);
    expect(account.externalId).toMatch(/^home:[0-9a-f]{16}$/);
  });

  it('falls back to the newest rate limits in session logs when the request fails', async () => {
    const { home, dir, login } = await codexHome();
    await writeText(
      join(dir, 'sessions', '2026', '11', '02', 'rollout-a.jsonl'),
      jsonl(
        {
          timestamp: '2026-11-02T10:00:00Z',
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: null,
            rate_limits: {
              primary: { used_percent: 10, window_minutes: 300, resets_in_seconds: 600 },
              secondary: { used_percent: 50, window_minutes: 10080, resets_at: 1_794_000_000 },
            },
          },
        },
        {
          timestamp: '2026-11-02T11:00:00Z',
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: null,
            rate_limits: {
              primary: { used_percent: 20, window_minutes: 300, resets_in_seconds: 7200 },
              secondary: { used_percent: 55, window_minutes: 10080, resets_at: 1_794_000_000 },
            },
          },
        },
      ),
    );
    const account = await codexProvider.read(login, testEnv(home), opts);
    const snap = account.snapshot;
    expect(snap?.status).toBe('ok');
    expect(snap?.message).toMatch(/last Codex session/);
    expect(syncAccountSchema.parse(account)).toEqual(account);
    expect(snap?.capturedAt).toBe('2026-11-02T11:00:00.000Z');
    expect(snap?.windows.map((w) => [w.kind, w.utilization, w.resetsAt])).toEqual([
      ['session', 20, '2026-11-02T13:00:00.000Z'],
      ['weekly', 55, new Date(1_794_000_000_000).toISOString()],
    ]);
  });

  it('reports an error when the request fails and no session saw limits', async () => {
    const { home, login } = await codexHome();
    const account = await codexProvider.read(login, testEnv(home), opts);
    expect(account.snapshot?.status).toBe('error');
    expect(account.snapshot?.windows).toEqual([]);
  });
});

describe('codex tokens', () => {
  it('sums token_count deltas per local day and model, skipping repeats and fork copies', async () => {
    const { home, dir, login } = await codexHome();
    const usage = (input: number, cached: number, output: number, reasoning: number) => ({
      input_tokens: input,
      cached_input_tokens: cached,
      output_tokens: output,
      reasoning_output_tokens: reasoning,
      total_tokens: input + output,
    });
    const lines = [
      { timestamp: '2026-11-02T09:00:00Z', type: 'session_meta', payload: { id: 's1', cwd: '/x' } },
      {
        timestamp: '2026-11-02T09:00:01Z',
        type: 'turn_context',
        payload: { model: 'gpt-5-codex' },
      },
      {
        timestamp: '2026-11-02T09:00:05Z',
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: usage(100, 40, 10, 4),
            last_token_usage: usage(100, 40, 10, 4),
          },
        },
      },
      // The same totals reported again: not a new request.
      {
        timestamp: '2026-11-02T09:00:06Z',
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: usage(100, 40, 10, 4),
            last_token_usage: usage(100, 40, 10, 4),
          },
        },
      },
      {
        timestamp: '2026-11-02T09:01:00Z',
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: { total_token_usage: usage(150, 60, 15, 4), last_token_usage: usage(50, 20, 5, 0) },
        },
      },
      { timestamp: '2026-11-02T09:02:00Z', type: 'turn_context', payload: { model: 'gpt-5' } },
      {
        timestamp: '2026-11-02T09:03:00Z',
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: { total_token_usage: usage(160, 60, 17, 4), last_token_usage: usage(10, 0, 2, 0) },
        },
      },
    ];
    await writeText(join(dir, 'sessions', '2026', '11', '02', 'rollout-1.jsonl'), jsonl(...lines));
    // A forked session copies the first usage line verbatim.
    await writeText(
      join(dir, 'sessions', '2026', '11', '02', 'rollout-fork.jsonl'),
      jsonl(lines[1], lines[2]),
    );

    const account = await codexProvider.read(login, testEnv(home), {
      sinceDay: SINCE,
      fetchLimits: false,
    });
    const day = localDay(new Date('2026-11-02T09:00:00Z'));
    expect(account.snapshot).toBeNull();
    expect(account.dailyTokens).toEqual([
      { day, model: 'gpt-5', input: 10, output: 2, cacheWrite: 0, cacheRead: 0, messages: 1 },
      {
        day,
        model: 'gpt-5-codex',
        input: 90,
        output: 15,
        cacheWrite: 0,
        cacheRead: 60,
        messages: 2,
      },
    ]);
  });
});

describe('codex commands', () => {
  it('names who a login signed in, and nobody before auth.json names an account', async () => {
    const empty = await tempHome();
    expect(await codexProvider.signedInAs(join(empty, 'c1'))).toBeNull();
    const apiKeyOnly = await tempHome();
    await writeJson(join(apiKeyOnly, 'auth.json'), { OPENAI_API_KEY: 'sk-abc' });
    expect(await codexProvider.signedInAs(apiKeyOnly)).toBeNull();
    const { dir } = await codexHome();
    expect(await codexProvider.signedInAs(dir)).toBe('acct-1');
  });

  it('signs a new account into its own CODEX_HOME, by browser or by device code', () => {
    expect(codexProvider.loginCommand('/m/codex/c1')).toEqual({
      command: 'codex',
      args: ['login'],
      env: { CODEX_HOME: '/m/codex/c1' },
      linkHosts: ['auth.openai.com'],
    });
    expect(codexProvider.loginCommand('/m/codex/c1', { deviceCode: true }).args).toEqual([
      'login',
      '--device-auth',
    ]);
    const base = { provider: 'codex' as const, managed: true };
    expect(codexProvider.launchEnv({ ...base, home: '/h/.codex', isDefault: true })).toEqual({});
    expect(codexProvider.launchEnv({ ...base, home: '/m/codex/c1', isDefault: false })).toEqual({
      CODEX_HOME: '/m/codex/c1',
    });
  });
});

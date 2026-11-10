import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { resolvePlan } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { claudeCodeProvider } from '../claude-code';
import { keychainAccount, keychainServiceFor, reportedPlan } from '../claude-code/credentials';
import { parseClaudeStatusline, parseClaudeUsage } from '../claude-code/usage-api';
import { localDay, sha256Hex } from '../lib/util';
import type { DetectedLogin } from '../types';
import {
  claudeAssistantLine,
  fakeFetch,
  jsonl,
  NOW,
  SINCE,
  tempHome,
  testEnv,
  writeJson,
  writeText,
} from './helpers';

const FUTURE = NOW.getTime() + 3_600_000;
const opts = { sinceDay: SINCE, fetchLimits: true };

async function loggedIn(
  dirName = '.claude-work',
  oauth: Record<string, unknown> = {
    accessToken: 'tok-work',
    expiresAt: FUTURE,
    subscriptionType: 'max',
    rateLimitTier: 'default_claude_max_5x',
  },
) {
  const home = await tempHome();
  const dir = join(home, dirName);
  await writeJson(join(dir, '.credentials.json'), { claudeAiOauth: oauth });
  await writeJson(join(dir, '.claude.json'), {
    oauthAccount: {
      accountUuid: 'uuid-work',
      emailAddress: 'Me@Work.dev',
      organizationName: 'Work Org',
    },
  });
  const login: DetectedLogin = {
    provider: 'claude-code',
    home: dir,
    isDefault: false,
    managed: false,
  };
  return { home, dir, login };
}

describe('claude-code detect', () => {
  it('finds ~/.claude, marked ~/.claude-* dirs, CLAUDE_CONFIG_DIR and managed homes', async () => {
    const { home, dir } = await loggedIn();
    await mkdir(join(home, '.claude'), { recursive: true });
    await writeText(join(home, '.claude-empty', 'README'), 'no markers');
    await writeText(join(home, '.clauderc'), 'a file');
    await writeJson(join(home, 'elsewhere', 'settings.json'), {});
    await mkdir(join(home, 'managed', 'claude-code', 'acct-1'), { recursive: true });

    const env = testEnv(home, { env: { CLAUDE_CONFIG_DIR: join(home, 'elsewhere') } });
    const found = await claudeCodeProvider.detect(env);

    expect(found).toEqual([
      { provider: 'claude-code', home: join(home, '.claude'), isDefault: true, managed: false },
      { provider: 'claude-code', home: join(home, 'elsewhere'), isDefault: false, managed: false },
      { provider: 'claude-code', home: dir, isDefault: false, managed: false },
      {
        provider: 'claude-code',
        home: join(home, 'managed', 'claude-code', 'acct-1'),
        isDefault: false,
        managed: true,
      },
    ]);
  });

  it('counts the default login from ~/.claude.json alone (macOS keeps the token in the Keychain)', async () => {
    const home = await tempHome();
    await writeJson(join(home, '.claude.json'), { oauthAccount: { emailAddress: 'a@b.c' } });
    const found = await claudeCodeProvider.detect(testEnv(home));
    expect(found.map((l) => [l.home, l.isDefault])).toEqual([[join(home, '.claude'), true]]);
  });
});

describe('claude-code credentials', () => {
  it('names the Keychain item by config dir: bare for ~/.claude, hashed suffix otherwise', () => {
    const home = '/Users/me';
    expect(keychainServiceFor('/Users/me/.claude', home)).toBe('Claude Code-credentials');
    const dir = '/Users/me/.claude-work';
    expect(keychainServiceFor(dir, home)).toBe(
      `Claude Code-credentials-${sha256Hex(dir).slice(0, 8)}`,
    );
  });

  it('reads the Keychain on macOS when there is no credentials file', async () => {
    const home = await tempHome();
    const dir = join(home, '.claude-mac');
    await writeJson(join(dir, 'settings.json'), {});
    const asked: string[] = [];
    const { fn, calls } = fakeFetch({ seven_day: { utilization: 10, resets_at: null } });
    const env = testEnv(home, {
      platform: 'darwin',
      env: { USER: 'me' },
      fetch: fn,
      readKeychain: async (service, account) => {
        asked.push(`${service}/${account}`);
        return JSON.stringify({ claudeAiOauth: { accessToken: 'kc-token', expiresAt: FUTURE } });
      },
    });
    const account = await claudeCodeProvider.read(
      { provider: 'claude-code', home: dir, isDefault: false, managed: false },
      env,
      opts,
    );
    // Under the login name, as Claude Code 2.1+ files it.
    expect(asked).toEqual([`${keychainServiceFor(dir, home)}/me`]);
    expect(calls[0]?.headers.Authorization).toBe('Bearer kc-token');
    expect(account.snapshot?.status).toBe('ok');
  });

  it('prefers the Keychain over a leftover credentials file on macOS', async () => {
    const { home, login } = await loggedIn('.claude-both', {
      accessToken: 'stale-file-token',
      expiresAt: NOW.getTime() - 1,
    });
    const { fn, calls } = fakeFetch({ seven_day: { utilization: 10, resets_at: null } });
    const env = testEnv(home, {
      platform: 'darwin',
      fetch: fn,
      readKeychain: async () =>
        JSON.stringify({ claudeAiOauth: { accessToken: 'kc-token', expiresAt: FUTURE } }),
    });
    await claudeCodeProvider.read(login, env, opts);
    expect(calls[0]?.headers.Authorization).toBe('Bearer kc-token');
  });

  it('files the Keychain item under claude-code-user for a login name Claude would not use', () => {
    expect(keychainAccount({ USER: 'me.dev' })).toBe('me.dev');
    expect(keychainAccount({ USER: 'me@sso.example.com' })).toBe('claude-code-user');
  });

  it('hashes the config dir in Unicode NFC', () => {
    const decomposed = '/Users/me/.claude-cafe\u0301';
    expect(keychainServiceFor(decomposed, '/Users/me')).toBe(
      `Claude Code-credentials-${sha256Hex(decomposed.normalize('NFC')).slice(0, 8)}`,
    );
  });

  it('reports the tier when the catalog knows it, and Max 20x resolves to Ultra', () => {
    const plan = reportedPlan({ subscriptionType: 'max', rateLimitTier: 'default_claude_max_20x' });
    expect(plan).toBe('default_claude_max_20x');
    expect(resolvePlan('claude-code', plan)?.id).toBe('claude-ultra');
    expect(reportedPlan({ subscriptionType: 'pro', rateLimitTier: 'some_future_tier' })).toBe(
      'pro',
    );
  });
  it('reports a Team seat as Team, not as the Max-sized tier it carries', () => {
    // A Team Premium seat reads as Max (or Ultra) by its tier alone, with
    // the wrong price and windows; the subscription decides for a seat.
    for (const tier of ['default_claude_max_5x', 'default_claude_max_20x']) {
      const plan = reportedPlan({ subscriptionType: 'team', rateLimitTier: tier });
      expect(resolvePlan('claude-code', plan)?.id).toBe('claude-team-premium');
    }
    const standard = reportedPlan({ subscriptionType: 'team', rateLimitTier: 'default_claude_ai' });
    expect(resolvePlan('claude-code', standard)?.id).toBe('claude-team-standard');
    expect(
      resolvePlan('claude-code', reportedPlan({ subscriptionType: 'team', rateLimitTier: null }))
        ?.id,
    ).toBe('claude-team-standard');
    const enterprise = reportedPlan({
      subscriptionType: 'enterprise',
      rateLimitTier: 'default_claude_max_5x',
    });
    expect(resolvePlan('claude-code', enterprise)?.id).toBe('claude-enterprise');
  });
});

describe('claude-code usage parsing', () => {
  it('maps windows to kinds, keeps unknown keys and reads extra usage', () => {
    const parsed = parseClaudeUsage({
      seven_day_opus: { utilization: 40, resets_at: '2026-11-05T00:00:00Z' },
      five_hour: { utilization: 62, resets_at: '2026-11-02T14:00:00+00:00' },
      seven_day: { utilization: 20, resets_at: null },
      seven_day_oauth_apps: null,
      brand_new_limit: { utilization: 5 },
      extra_usage: { is_enabled: true, monthly_limit: 5000, used_credits: 120, utilization: 2.4 },
    });
    expect(parsed.windows.map((w) => [w.key, w.kind, w.windowMinutes])).toEqual([
      ['five_hour', 'session', 300],
      ['seven_day', 'weekly', 10080],
      ['seven_day_opus', 'weekly_model', 10080],
      ['brand_new_limit', 'other', null],
    ]);
    expect(parsed.windows[0]?.resetsAt).toBe('2026-11-02T14:00:00.000Z');
    expect(parsed.extraUsage).toEqual({
      enabled: true,
      monthlyLimit: 5000,
      usedCredits: 120,
      utilization: 2.4,
      currency: null,
    });
  });

  it('handles a plan with only weekly windows (no 5-hour session)', () => {
    const parsed = parseClaudeUsage({
      five_hour: null,
      seven_day: { utilization: 33, resets_at: '2026-11-06T00:00:00Z' },
    });
    expect(parsed.windows.map((w) => w.kind)).toEqual(['weekly']);
  });

  it('reads model-scoped entries of a limits[] array as weekly_model', () => {
    const parsed = parseClaudeUsage({
      limits: [
        { key: 'weekly_fable', model: 'fable', utilization: 12, resets_at: 1_793_000_000 },
        { key: 'weekly_all', window_minutes: 10080, utilization: 30 },
      ],
    });
    expect(parsed.windows.map((w) => [w.key, w.kind])).toEqual([
      ['weekly_all', 'weekly'],
      ['weekly_fable', 'weekly_model'],
    ]);
    expect(parsed.windows[1]?.resetsAt).toBe(new Date(1_793_000_000_000).toISOString());
  });
});

describe('claude-code read', () => {
  it("combines identity, plan, limits and tokens, sending Orca's User-Agent", async () => {
    const { dir, home, login } = await loggedIn();
    await writeText(
      join(dir, 'projects', 'p', 's.jsonl'),
      jsonl(
        claudeAssistantLine({
          ts: '2026-11-02T10:00:00Z',
          id: 'm1',
          requestId: 'r1',
          input: 40,
          output: 2,
        }),
      ),
    );
    const { fn, calls } = fakeFetch({ five_hour: { utilization: 62, resets_at: null } });
    const account = await claudeCodeProvider.read(login, testEnv(home, { fetch: fn }), opts);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.anthropic.com/api/oauth/usage');
    expect(calls[0]?.headers).toMatchObject({
      Authorization: 'Bearer tok-work',
      'anthropic-beta': 'oauth-2025-04-20',
      'User-Agent': 'claude-code/2.1.0',
    });
    expect(account).toMatchObject({
      provider: 'claude-code',
      externalId: 'uuid-work',
      email: 'Me@Work.dev',
      organization: 'Work Org',
      reportedPlan: 'default_claude_max_5x',
      location: dir,
    });
    expect(account.snapshot?.status).toBe('ok');
    expect(account.snapshot?.windows[0]?.utilization).toBe(62);
    expect(account.dailyTokens).toHaveLength(1);
  });

  it('turns a 401 on a login with no refresh token into auth_expired', async () => {
    const { home, login } = await loggedIn();
    const account = await claudeCodeProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch({}, 401).fn }),
      opts,
    );
    expect(account.snapshot).toMatchObject({
      status: 'auth_expired',
      message: 'Sign in again to use this account.',
    });
  });

  it("turns a 429 into rate_limited with Orca's message", async () => {
    const { home, login } = await loggedIn();
    const account = await claudeCodeProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch({}, 429).fn }),
      opts,
    );
    expect(account.snapshot).toMatchObject({
      status: 'rate_limited',
      message: 'Claude usage is rate limited right now.',
    });
  });

  it('asks the server even when the stored token looks expired', async () => {
    const { home, login } = await loggedIn('.claude-old', {
      accessToken: 't',
      expiresAt: NOW.getTime() - 1,
    });
    const { fn, calls } = fakeFetch({ five_hour: { utilization: 5, resets_at: null } });
    const account = await claudeCodeProvider.read(login, testEnv(home, { fetch: fn }), opts);
    // The usage server, not the stored expiresAt, decides whether the token is valid.
    expect(calls).toHaveLength(1);
    expect(account.snapshot?.status).toBe('ok');
  });

  it('turns a rejection of a renewable login into auth_stale, for `claude auth status`', async () => {
    const { home, login } = await loggedIn('.claude-idle', {
      accessToken: 't',
      expiresAt: NOW.getTime() - 1,
      refreshToken: 'refresh-me',
      refreshTokenExpiresAt: NOW.getTime() + 30 * 86_400_000,
    });
    for (const status of [401, 403]) {
      const account = await claudeCodeProvider.read(
        login,
        testEnv(home, { fetch: fakeFetch({}, status).fn }),
        opts,
      );
      expect(account.snapshot).toMatchObject({
        status: 'auth_stale',
        message: 'Claude usage updates the next time Claude runs.',
      });
    }
  });

  it('needs a sign-in once the refresh token expired or the server says revoked', async () => {
    const { home, login } = await loggedIn('.claude-gone', {
      accessToken: 't',
      refreshToken: 'refresh-me',
      refreshTokenExpiresAt: NOW.getTime() - 1,
    });
    const expired = await claudeCodeProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch({}, 401).fn }),
      opts,
    );
    expect(expired.snapshot?.status).toBe('auth_expired');

    const renewable = await loggedIn('.claude-revoked', { accessToken: 't', refreshToken: 'r' });
    const revoked = await claudeCodeProvider.read(
      renewable.login,
      testEnv(renewable.home, {
        fetch: fakeFetch({ error: { message: 'OAuth token has been revoked' } }, 401).fn,
      }),
      opts,
    );
    expect(revoked.snapshot?.status).toBe('auth_expired');
  });

  it('shows a missing-scope 403 as the server says it, not as a sign-out', async () => {
    const { home, login } = await loggedIn('.claude-scope', {
      accessToken: 't',
      refreshToken: 'r',
    });
    const message = 'OAuth token does not meet scope requirement user:profile';
    const account = await claudeCodeProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch({ error: { message } }, 403).fn }),
      opts,
    );
    expect(account.snapshot).toMatchObject({ status: 'error', message });
  });

  it('reports a server error as unavailable, keeping the login', async () => {
    const { home, login } = await loggedIn();
    const account = await claudeCodeProvider.read(
      login,
      testEnv(home, { fetch: fakeFetch({}, 503).fn }),
      opts,
    );
    expect(account.snapshot).toMatchObject({
      status: 'error',
      message: 'Claude usage is unavailable (HTTP 503).',
    });
  });

  it('turns a network failure into an error status instead of throwing', async () => {
    const { home, login } = await loggedIn();
    const account = await claudeCodeProvider.read(login, testEnv(home), opts);
    expect(account.snapshot?.status).toBe('error');
    expect(account.snapshot?.message).toContain('network disabled');
  });

  it('reports a missing login as no_credentials and falls back to an email externalId', async () => {
    const home = await tempHome();
    const dir = join(home, '.claude-x');
    await writeJson(join(dir, '.claude.json'), { oauthAccount: { emailAddress: 'X@Y.dev' } });
    const account = await claudeCodeProvider.read(
      { provider: 'claude-code', home: dir, isDefault: false, managed: false },
      testEnv(home),
      opts,
    );
    expect(account.snapshot?.status).toBe('no_credentials');
    expect(account.externalId).toBe('email:x@y.dev');
  });

  it('skips the network when fetchLimits is false but still reads identity and tokens', async () => {
    const { home, login } = await loggedIn();
    const { fn, calls } = fakeFetch({});
    const account = await claudeCodeProvider.read(login, testEnv(home, { fetch: fn }), {
      sinceDay: SINCE,
      fetchLimits: false,
    });
    expect(calls).toHaveLength(0);
    expect(account.snapshot).toBeNull();
    expect(account.reportedPlan).toBe('default_claude_max_5x');
    expect(account.externalId).toBe('uuid-work');
  });
});

describe('claude-code tokens', () => {
  it('sums per local day and model, drops duplicates, synthetic and pre-sinceDay lines', async () => {
    const { home, dir, login } = await loggedIn();
    const day1 = '2026-11-01T09:00:00Z';
    const day2 = '2026-11-02T09:00:00Z';
    await writeText(
      join(dir, 'projects', 'a', 'one.jsonl'),
      [
        jsonl(
          claudeAssistantLine({
            ts: day1,
            id: 'm1',
            requestId: 'r1',
            input: 10,
            output: 5,
            cacheWrite: 3,
            cacheRead: 100,
          }),
          claudeAssistantLine({ ts: day1, id: 'm2', requestId: 'r2', input: 1, output: 1 }),
          claudeAssistantLine({
            ts: day2,
            id: 'm3',
            requestId: 'r3',
            model: 'claude-opus-4-5',
            input: 7,
          }),
          claudeAssistantLine({ ts: day2, model: '<synthetic>', input: 999 }),
          claudeAssistantLine({
            ts: '2026-09-01T09:00:00Z',
            id: 'old',
            requestId: 'old',
            input: 999,
          }),
          { type: 'user', timestamp: day1, message: { role: 'user', content: 'hi' } },
        ),
        'not json {',
      ].join('\n'),
    );
    // A resumed session repeats an earlier message.
    await writeText(
      join(dir, 'projects', 'b', 'two.jsonl'),
      jsonl(claudeAssistantLine({ ts: day1, id: 'm1', requestId: 'r1', input: 10, output: 5 })),
    );
    // A file untouched since before sinceDay is not read at all.
    await writeText(
      join(dir, 'projects', 'c', 'stale.jsonl'),
      jsonl(claudeAssistantLine({ ts: day2, id: 's', requestId: 's', input: 5000 })),
      new Date('2026-08-01T00:00:00Z'),
    );

    const account = await claudeCodeProvider.read(login, testEnv(home), {
      sinceDay: SINCE,
      fetchLimits: false,
    });
    expect(account.dailyTokens).toEqual([
      {
        day: localDay(new Date(day1)),
        model: 'claude-sonnet-4-5',
        input: 11,
        output: 6,
        cacheWrite: 3,
        cacheRead: 100,
        messages: 2,
      },
      {
        day: localDay(new Date(day2)),
        model: 'claude-opus-4-5',
        input: 7,
        output: 0,
        cacheWrite: 0,
        cacheRead: 0,
        messages: 1,
      },
    ]);
  });
});

describe('claude-code commands', () => {
  it('signs a new account into its own config dir', () => {
    expect(claudeCodeProvider.loginCommand('/m/claude-code/a1')).toEqual({
      command: 'claude',
      args: ['auth', 'login', '--claudeai'],
      env: { CLAUDE_CONFIG_DIR: '/m/claude-code/a1' },
      capturesBrowser: true,
    });
  });

  it('names who a login signed in, and nobody for a folder the CLI left without an account', async () => {
    const home = await tempHome();
    const dir = join(home, 'managed', 'a1');
    expect(await claudeCodeProvider.signedInAs(dir)).toBeNull();
    // A credential alone is not a sign-in the app can name.
    await writeJson(join(dir, '.credentials.json'), { claudeAiOauth: { accessToken: 't' } });
    expect(await claudeCodeProvider.signedInAs(dir)).toBeNull();
    await writeJson(join(dir, '.claude.json'), {
      oauthAccount: { accountUuid: 'uuid-new', emailAddress: 'new@x.dev' },
    });
    expect(await claudeCodeProvider.signedInAs(dir)).toBe('uuid-new');
    await writeJson(join(dir, '.claude.json'), { oauthAccount: { emailAddress: 'New@X.dev' } });
    expect(await claudeCodeProvider.signedInAs(dir)).toBe('email:new@x.dev');
  });

  it('leaves the default login without CLAUDE_CONFIG_DIR', () => {
    const base = { provider: 'claude-code' as const, managed: false };
    expect(claudeCodeProvider.launchEnv({ ...base, home: '/h/.claude', isDefault: true })).toEqual(
      {},
    );
    expect(
      claudeCodeProvider.launchEnv({ ...base, home: '/h/.claude-w', isDefault: false }),
    ).toEqual({
      CLAUDE_CONFIG_DIR: '/h/.claude-w',
    });
  });

  it('refreshes a login with `claude auth status` — no CLAUDE_CONFIG_DIR for the default', () => {
    const base = { provider: 'claude-code' as const, managed: false };
    // The default `~/.claude` carries no CLAUDE_CONFIG_DIR, so Claude Code
    // refreshes the Keychain item it would use in a terminal on macOS.
    expect(
      claudeCodeProvider.refreshCommand?.({ ...base, home: '/h/.claude', isDefault: true }),
    ).toEqual({ command: 'claude', args: ['auth', 'status'], env: {} });
    expect(
      claudeCodeProvider.refreshCommand?.({ ...base, home: '/h/.claude-w', isDefault: false }),
    ).toEqual({
      command: 'claude',
      args: ['auth', 'status'],
      env: { CLAUDE_CONFIG_DIR: '/h/.claude-w' },
    });
  });
});

describe('parseClaudeStatusline', () => {
  it('reads rate_limits with epoch-second and ISO resets', () => {
    const windows = parseClaudeStatusline({
      model: { id: 'claude-opus-4-5' },
      rate_limits: {
        seven_day: { utilization: 41, resets_at: '2026-11-06T00:00:00Z' },
        five_hour: { used_percentage: 12.5, resets_at: 1_793_000_000 },
      },
    });
    expect(windows).toEqual([
      {
        key: 'five_hour',
        kind: 'session',
        label: 'Session (5h)',
        utilization: 12.5,
        resetsAt: new Date(1_793_000_000_000).toISOString(),
        windowMinutes: 300,
      },
      {
        key: 'seven_day',
        kind: 'weekly',
        label: 'Weekly · all models',
        utilization: 41,
        resetsAt: '2026-11-06T00:00:00.000Z',
        windowMinutes: 10080,
      },
    ]);
  });

  it('returns null when the statusline carries no limits', () => {
    expect(parseClaudeStatusline({ model: { id: 'x' } })).toBeNull();
    expect(parseClaudeStatusline({ rate_limits: {} })).toBeNull();
    expect(parseClaudeStatusline('not json')).toBeNull();
    expect(parseClaudeStatusline(null)).toBeNull();
  });
});

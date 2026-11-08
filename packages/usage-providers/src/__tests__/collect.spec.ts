import { join } from 'node:path';
import { syncAccountSchema } from '@flama/shared/schemas/accounts';
import { describe, expect, it } from 'vitest';
import { claudeCodeProvider } from '../claude-code';
import { collectAll } from '../collect';
import { nodeProviderEnv } from '../env';
import { defineProviders, PROVIDERS } from '../registry';
import type { CodingAgentProvider } from '../types';
import { fakeFetch, NOW, SINCE, tempHome, testEnv, writeJson } from './helpers';

const opts = { sinceDay: SINCE, fetchLimits: true };

describe('registry', () => {
  it('lists Claude Code first, then Codex, then Grok Build', () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(['claude-code', 'codex', 'grok']);
  });

  it('refuses two providers with one id', () => {
    expect(() => defineProviders([claudeCodeProvider, claudeCodeProvider])).toThrow(/Duplicate/);
  });
});

describe('collectAll', () => {
  it('collapses two logins of one account into the default one', async () => {
    const home = await tempHome();
    const oauth = { claudeAiOauth: { accessToken: 't', expiresAt: NOW.getTime() + 60_000 } };
    const identity = { oauthAccount: { accountUuid: 'same-uuid', emailAddress: 'a@b.dev' } };
    // The same account signed in twice: the default dir and a managed copy.
    await writeJson(join(home, '.claude', '.credentials.json'), oauth);
    await writeJson(join(home, '.claude.json'), identity);
    const managed = join(home, 'managed', 'claude-code', 'm1');
    await writeJson(join(managed, '.credentials.json'), oauth);
    await writeJson(join(managed, '.claude.json'), identity);
    // A different account.
    const other = join(home, '.claude-other');
    await writeJson(join(other, '.credentials.json'), oauth);
    await writeJson(join(other, '.claude.json'), { oauthAccount: { accountUuid: 'other-uuid' } });

    const env = testEnv(home, { fetch: fakeFetch({ seven_day: { utilization: 1 } }).fn });
    const collected = await collectAll(env, opts);

    expect(collected.map((c) => [c.account.externalId, c.login.home])).toEqual([
      ['same-uuid', join(home, '.claude')],
      ['other-uuid', other],
    ]);
    for (const { account } of collected) expect(syncAccountSchema.parse(account)).toEqual(account);
  });

  it('turns a provider that throws into an error account instead of failing the sync', async () => {
    const home = await tempHome();
    const broken: CodingAgentProvider = {
      ...claudeCodeProvider,
      detect: async () => [
        { provider: 'claude-code', home: '/nowhere', isDefault: false, managed: true },
      ],
      read: async () => {
        throw new Error('boom');
      },
    };
    const [item] = await collectAll(testEnv(home), opts, [broken]);
    expect(item?.account.snapshot?.status).toBe('error');
    expect(item?.account.snapshot?.message).toBe('boom');
    expect(item?.account.externalId).toMatch(/^home:/);
  });
});

describe('nodeProviderEnv', () => {
  it('only reads the Keychain on macOS', async () => {
    const env = nodeProviderEnv({
      managedRoot: '/tmp/m',
      userAgent: 'resetowl-desktop/test',
      platform: 'linux',
    });
    expect(await env.readKeychain('Claude Code-credentials')).toBeNull();
    expect(env.userAgent).toBe('resetowl-desktop/test');
  });
});

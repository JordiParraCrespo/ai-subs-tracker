import type { SyncAccount } from '@flama/shared/schemas/accounts';
import { syncAccountsSchema } from '@flama/shared/schemas/accounts';
import type { CodingAgentProvider, DetectedLogin, ProviderEnv } from '@flama/usage-providers';
import { describe, expect, it } from 'vitest';
import { buildSyncInput, readLocalAccounts, sinceDayFor, toLocalLogins } from '../local-logins';

function account(over: Partial<SyncAccount> = {}): SyncAccount {
  return {
    provider: 'claude-code',
    externalId: 'acc-1',
    email: 'maya@example.com',
    organization: null,
    reportedPlan: 'max',
    location: '/h/.claude',
    snapshot: null,
    dailyTokens: [],
    ...over,
  };
}

const env = { now: () => new Date('2026-11-02T12:00:00Z') } as ProviderEnv;

function fakeProvider(
  logins: DetectedLogin[],
  read: CodingAgentProvider['read'],
): CodingAgentProvider {
  return {
    id: 'claude-code',
    displayName: 'Claude Code',
    detect: async () => logins,
    read,
    loginCommand: () => ({ command: 'claude', args: [], env: {} }),
    launchEnv: () => ({}),
  };
}

describe('sync payload', () => {
  it('builds a SyncAccountsInput the API schema accepts', () => {
    const input = buildSyncInput(
      [
        {
          login: { provider: 'claude-code', home: '/h/.claude', isDefault: true, managed: false },
          account: account(),
        },
      ],
      { name: 'maya-mbp', platform: 'darwin' },
    );
    expect(syncAccountsSchema.parse(input)).toEqual(input);
    expect(input.device).toEqual({ name: 'maya-mbp', platform: 'darwin' });
  });

  it('bounds the device name and the account count to the contract', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      login: { provider: 'claude-code' as const, home: `/h/${i}`, isDefault: false, managed: true },
      account: account({ externalId: `a${i}` }),
    }));
    const input = buildSyncInput(many, { name: 'x'.repeat(300), platform: 'linux' });
    expect(input.accounts).toHaveLength(50);
    expect(input.device.name).toHaveLength(120);
    expect(() => syncAccountsSchema.parse(input)).not.toThrow();
  });

  it('counts tokens from the local day seven days back', () => {
    expect(sinceDayFor(new Date(2026, 10, 2, 9, 0))).toBe('2026-10-26');
  });

  it('asks for limits per login, and collapses two logins of one account onto the default', async () => {
    const seen: Array<[string, boolean]> = [];
    const provider = fakeProvider(
      [
        { provider: 'claude-code', home: '/h/.claude-alias', isDefault: false, managed: false },
        { provider: 'claude-code', home: '/h/.claude', isDefault: true, managed: false },
      ],
      async (login, _env, opts) => {
        seen.push([login.home, opts.fetchLimits]);
        return account({ location: login.home });
      },
    );
    const out = await readLocalAccounts(
      env,
      { sinceDay: '2026-10-26', fetchLimitsFor: (l) => l.isDefault },
      [provider],
    );
    expect(seen).toEqual(
      expect.arrayContaining([
        ['/h/.claude-alias', false],
        ['/h/.claude', true],
      ]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.login.home).toBe('/h/.claude');
  });

  it('marks the login the pointer names as active', () => {
    const items = [
      {
        login: {
          provider: 'claude-code' as const,
          home: '/h/.claude',
          isDefault: true,
          managed: false,
        },
        account: account(),
      },
      {
        login: { provider: 'claude-code' as const, home: '/h/b', isDefault: false, managed: true },
        account: account({ externalId: 'acc-2' }),
      },
    ];
    expect(toLocalLogins(items, { 'claude-code': '' }).map((l) => l.active)).toEqual([true, false]);
    expect(toLocalLogins(items, { 'claude-code': '/h/b' }).map((l) => l.active)).toEqual([
      false,
      true,
    ]);
  });
});

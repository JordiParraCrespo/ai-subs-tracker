import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { codexProvider, type ProviderEnv } from '@flama/usage-providers';
import { describe, expect, it } from 'vitest';
import type { LocalAccount } from '../local-logins';
import { checkNewLogin, checkRenewedLogin } from '../verify-login';
import { tempDir } from './helpers';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

async function codexLogin(dir: string, account: string, email: string) {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'auth.json'),
    JSON.stringify({
      tokens: { access_token: 'a', account_id: account, id_token: jwt({ email }) },
    }),
  );
}

function env(home: string): ProviderEnv {
  return {
    home,
    platform: 'linux',
    env: {},
    now: () => new Date('2026-11-05T12:00:00Z'),
    fetch: (async () => {
      throw new Error('no network in tests');
    }) as typeof fetch,
    userAgent: 'resetowl-desktop/test',
    managedRoot: join(home, 'managed'),
    readKeychain: async () => null,
  };
}

/** What the collector holds for a Codex login already on the machine. */
function known(home: string, externalId: string, email: string): LocalAccount {
  return {
    login: { provider: 'codex', home, isDefault: true, managed: false },
    account: {
      provider: 'codex',
      externalId,
      email,
      organization: null,
      reportedPlan: null,
      location: home,
      snapshot: null,
      dailyTokens: [],
    },
  };
}

describe('checking a new sign-in', () => {
  it('keeps a new account and names the one already on this machine', async () => {
    const home = await tempDir();
    const accounts = [known(join(home, '.codex'), 'acct-1', 'me@example.com')];
    const fresh = join(home, 'managed', 'codex', 'new');

    await codexLogin(fresh, 'acct-2', 'other@example.com');
    expect(await checkNewLogin(codexProvider, fresh, accounts, env(home))).toBeNull();

    // Regression: the same account in a second folder was "added" and then
    // merged away in the list, its folder polled and its tokens rotated twice.
    await codexLogin(fresh, 'acct-1', 'Me@example.com');
    expect(await checkNewLogin(codexProvider, fresh, accounts, env(home))).toBe(
      'That is Me@example.com, already added.',
    );
  });

  it('does not count the new folder, read by a collection mid sign-in, as a duplicate', async () => {
    const home = await tempDir();
    const fresh = join(home, 'managed', 'codex', 'new');
    await codexLogin(fresh, 'acct-1', 'me@example.com');
    const accounts = [known(fresh, 'acct-1', 'me@example.com')];
    expect(await checkNewLogin(codexProvider, fresh, accounts, env(home))).toBeNull();
  });

  it('says why when a second seat of one workspace would collapse into the first', async () => {
    const home = await tempDir();
    const accounts = [known(join(home, '.codex'), 'team-1', 'a@example.com')];
    const fresh = join(home, 'managed', 'codex', 'new');
    await codexLogin(fresh, 'team-1', 'b@example.com');
    expect(await checkNewLogin(codexProvider, fresh, accounts, env(home))).toMatch(
      /b@example\.com.*cannot yet keep apart from a@example\.com/,
    );
  });

  it('refuses a folder the CLI left without an account', async () => {
    const home = await tempDir();
    const fresh = join(home, 'managed', 'codex', 'new');
    await mkdir(fresh, { recursive: true });
    expect(await checkNewLogin(codexProvider, fresh, [], env(home))).toBe(
      'Codex finished without signing an account in.',
    );
  });
});

describe('checking a login signed in again', () => {
  // Regression (#42): a stale or signed-out login had no way back from the
  // screens; signing it in again must land on the same account, in its folder.
  it('keeps the account it was asked to renew, and refuses another or none', async () => {
    const home = await tempDir();
    const dir = join(home, '.codex');
    const login = { provider: 'codex' as const, home: dir, isDefault: true, managed: false };
    await mkdir(dir, { recursive: true });
    expect(await checkRenewedLogin(codexProvider, login, 'acct-1', [], env(home))).toBe(
      'Codex finished without signing an account in.',
    );

    await codexLogin(dir, 'acct-1', 'me@example.com');
    expect(await checkRenewedLogin(codexProvider, login, 'acct-1', [], env(home))).toBeNull();

    await codexLogin(dir, 'acct-2', 'other@example.com');
    expect(await checkRenewedLogin(codexProvider, login, 'acct-1', [], env(home))).toMatch(
      /different account/,
    );
  });

  it('lets a login that named nobody take the account that signs in, unless already added', async () => {
    const home = await tempDir();
    const dir = join(home, '.codex');
    const login = { provider: 'codex' as const, home: dir, isDefault: true, managed: false };
    await codexLogin(dir, 'acct-2', 'new@example.com');
    expect(await checkRenewedLogin(codexProvider, login, 'home:0123', [], env(home))).toBeNull();

    const elsewhere = [known(join(home, 'managed', 'codex', 'x'), 'acct-2', 'new@example.com')];
    expect(await checkRenewedLogin(codexProvider, login, 'home:0123', elsewhere, env(home))).toBe(
      'That is new@example.com, already added.',
    );
  });
});

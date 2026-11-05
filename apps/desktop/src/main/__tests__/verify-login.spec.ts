import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { codexProvider, type ProviderEnv } from '@flama/usage-providers';
import { describe, expect, it } from 'vitest';
import { checkNewLogin } from '../verify-login';
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

describe('checking a new sign-in', () => {
  it('keeps a new account and refuses one already on this machine', async () => {
    const home = await tempDir();
    await codexLogin(join(home, '.codex'), 'acct-1', 'me@example.com');
    const fresh = join(home, 'managed', 'codex', 'new');

    await codexLogin(fresh, 'acct-2', 'other@example.com');
    expect(await checkNewLogin(codexProvider, fresh, env(home))).toBeNull();

    // Regression: the same account in a second folder was "added" and then
    // dropped from the list, its folder polled and its tokens rotated twice.
    await codexLogin(fresh, 'acct-1', 'Me@example.com');
    expect(await checkNewLogin(codexProvider, fresh, env(home))).toBe(
      'That is Me@example.com, already added.',
    );
  });

  it('says why when a second seat of one workspace would collapse into the first', async () => {
    const home = await tempDir();
    await codexLogin(join(home, '.codex'), 'team-1', 'a@example.com');
    const fresh = join(home, 'managed', 'codex', 'new');
    await codexLogin(fresh, 'team-1', 'b@example.com');
    expect(await checkNewLogin(codexProvider, fresh, env(home))).toMatch(
      /b@example\.com.*cannot yet keep apart from a@example\.com/,
    );
  });

  it('refuses a folder the CLI left without a usable login', async () => {
    const home = await tempDir();
    const fresh = join(home, 'managed', 'codex', 'new');
    await mkdir(fresh, { recursive: true });
    expect(await checkNewLogin(codexProvider, fresh, env(home))).toMatch(/without saving/);
  });
});

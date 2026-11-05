import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { provisionedUser } from '../../support/web';

/**
 * The desktop app against the real stack: the Electron build, its collector
 * reading logins from a home on disk, and the sync to the API this checkout
 * built. Run it with `pnpm --filter @flama/e2e e2e:desktop` after building
 * `@flama/web` and `@flama/desktop`; on Linux without a display, under
 * `xvfb-run -a`.
 *
 * The logins are written so no provider is ever called: the Claude logins
 * expired and the Codex one has no access token, which the providers answer
 * from disk (`auth_expired`, `no_credentials`). Identity, plan and token
 * counts still sync, which is the path under test; no credential, real or
 * not, leaves the machine.
 */

const DESKTOP = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'apps',
  'desktop',
);
const electronPath = createRequire(join(DESKTOP, 'package.json'))('electron') as unknown as string;

const jwt = (payload: Record<string, unknown>) => {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none' })}.${part(payload)}.sig`;
};

async function write(path: string, body: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}
const json = (value: unknown) => JSON.stringify(value);
const jsonl = (...lines: unknown[]) => lines.map((line) => JSON.stringify(line)).join('\n');

/** A machine with two Claude Code logins and one Codex login, each used an hour ago. */
async function machineHome(tag: string) {
  const home = await mkdtemp(join(tmpdir(), 'resetowl-desktop-e2e-'));
  const at = new Date(Date.now() - 3_600_000);
  const day = at.toISOString().slice(0, 10).split('-');
  const expired = { accessToken: 'never-sent', expiresAt: Date.now() - 60_000 };
  const claude = (id: string, model: string, input: number) =>
    jsonl({
      type: 'assistant',
      timestamp: at.toISOString(),
      requestId: `req-${id}`,
      message: {
        id: `msg-${id}`,
        model,
        usage: { input_tokens: input, output_tokens: 2_000, cache_read_input_tokens: 50_000 },
      },
    });

  // The default login: ~/.claude, its account in ~/.claude.json.
  await write(
    join(home, '.claude', '.credentials.json'),
    json({
      claudeAiOauth: {
        ...expired,
        subscriptionType: 'max',
        rateLimitTier: 'default_claude_max_20x',
      },
    }),
  );
  await write(
    join(home, '.claude.json'),
    json({ oauthAccount: { accountUuid: `claude-${tag}`, emailAddress: `${tag}@claude.e2e` } }),
  );
  await write(
    join(home, '.claude', 'projects', 'p', 's.jsonl'),
    claude('a', 'claude-opus-4-1', 10_000),
  );

  // A second login in its own folder, as `CLAUDE_CONFIG_DIR=~/.claude-work claude` leaves it.
  const work = join(home, '.claude-work');
  await write(
    join(work, '.credentials.json'),
    json({ claudeAiOauth: { ...expired, subscriptionType: 'pro' } }),
  );
  await write(
    join(work, '.claude.json'),
    json({ oauthAccount: { accountUuid: `work-${tag}`, emailAddress: `${tag}@work.e2e` } }),
  );
  await write(join(work, 'projects', 'q', 't.jsonl'), claude('b', 'claude-sonnet-4-5', 20_000));

  // Codex signed in with ChatGPT, its access token gone: identity and plan from the id token.
  await write(
    join(home, '.codex', 'auth.json'),
    json({
      OPENAI_API_KEY: null,
      tokens: {
        id_token: jwt({
          email: `${tag}@codex.e2e`,
          'https://api.openai.com/auth': {
            chatgpt_plan_type: 'plus',
            chatgpt_account_id: `codex-${tag}`,
          },
        }),
        account_id: `codex-${tag}`,
      },
    }),
  );
  const usage = {
    input_tokens: 30_000,
    cached_input_tokens: 10_000,
    output_tokens: 3_000,
    reasoning_output_tokens: 0,
    total_tokens: 33_000,
  };
  await write(
    join(home, '.codex', 'sessions', ...day, 'rollout-e2e.jsonl'),
    jsonl(
      { timestamp: at.toISOString(), type: 'session_meta', payload: { id: `s-${tag}`, cwd: '/w' } },
      { timestamp: at.toISOString(), type: 'turn_context', payload: { model: 'gpt-5-codex' } },
      {
        timestamp: at.toISOString(),
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: { total_token_usage: usage, last_token_usage: usage },
        },
      },
    ),
  );
  return home;
}

interface SyncedAccount {
  id: string;
  provider: string;
  email: string | null;
  planName: string | null;
  isActive: boolean;
  latest: { status: string } | null;
}

test('the desktop app finds the logins on disk, syncs them, and switches the terminals', async () => {
  test.setTimeout(120_000);
  const { api, user } = await provisionedUser('desktop');
  const tag = user.email.split('@')[0].toLowerCase();
  const home = await machineHome(tag);

  const app = await electron.launch({
    executablePath: electronPath,
    args: [DESKTOP, '--no-sandbox'],
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: join(home, '.config'),
      CLAUDE_CONFIG_DIR: '',
      CODEX_HOME: '',
      RESETOWL_API_URL: API_URL,
    },
  });
  try {
    const page = await app.firstWindow();
    await expect(page).toHaveURL(/^app:\/\/resetowl\//);

    // Signed in through the app's own screens, with the bearer token the shell keeps.
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    // The sign-in starts a collection; the API holds what it sent.
    let accounts: SyncedAccount[] = [];
    await expect
      .poll(
        async () => {
          accounts = await (await api.get(`${API_URL}/api/v1/accounts`)).json();
          return accounts.map((account) => account.email).sort();
        },
        { timeout: 60_000 },
      )
      .toEqual([`${tag}@claude.e2e`, `${tag}@codex.e2e`, `${tag}@work.e2e`]);
    const byEmail = (email: string) => accounts.find((account) => account.email === email);
    expect(byEmail(`${tag}@claude.e2e`)).toMatchObject({
      provider: 'claude-code',
      planName: 'Ultra',
    });
    expect(byEmail(`${tag}@codex.e2e`)).toMatchObject({ provider: 'codex', planName: 'Plus' });
    expect(byEmail(`${tag}@claude.e2e`)?.latest?.status).toBe('auth_expired');
    expect(byEmail(`${tag}@codex.e2e`)?.latest?.status).toBe('no_credentials');

    // Token counts read from the transcripts, priced by model.
    const usage = await (await api.get(`${API_URL}/api/v1/accounts/usage?days=7`)).json();
    const models = usage.byModel.map((row: { model: string }) => row.model).sort();
    expect(models).toEqual(['claude-opus-4-1', 'claude-sonnet-4-5', 'gpt-5-codex']);
    expect(usage.totals.apiCostCents).toBeGreaterThan(0);

    // Switching a login on writes the pointer file the shell integration reads.
    await page.goto('app://resetowl/accounts/claude-code');
    const inactive = accounts.find(
      (account) => account.provider === 'claude-code' && !account.isActive,
    );
    expect(inactive).toBeDefined();
    const card = page.locator('.ds-card').filter({ hasText: inactive?.email ?? '' });
    await card.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(card.getByText('In use')).toBeVisible();
    const expected = inactive?.email?.endsWith('@work.e2e') ? resolve(home, '.claude-work') : '';
    await expect
      .poll(() =>
        readFile(join(home, '.resetowl', 'active', 'claude-code'), 'utf8').catch(() => null),
      )
      .toBe(expected);
  } finally {
    await app.close();
    await api.dispose();
  }
});

/** The link the fake CLI hands to `$BROWSER`: its callback is on localhost. */
const AUTO_LINK =
  'https://claude.com/cai/oauth/authorize?code=false&redirect_uri=http%3A%2F%2Flocalhost%3A45454%2Fcallback&state=e2e';

/**
 * A stand-in for `claude` on the app's PATH: it hands its automatic link to
 * `$BROWSER` and prints what Claude Code's login prints when its stdin is a
 * pipe (the manual link and the paste prompt), takes the code from that
 * prompt, and signs a login into `CLAUDE_CONFIG_DIR` as the real one would.
 * Nothing leaves the machine.
 */
async function fakeClaude(bin: string, email: string) {
  const script = `#!/bin/sh
[ -n "$BROWSER" ] && "$BROWSER" "${AUTO_LINK}"
echo "Opening browser to sign in…"
echo "If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&state=e2e"
printf 'Paste code here if prompted > '
read code
[ "$code" = "e2e-pasted-code" ] || exit 1
mkdir -p "$CLAUDE_CONFIG_DIR"
printf '%s' '${json({ claudeAiOauth: { accessToken: 'never-sent', expiresAt: 1, subscriptionType: 'pro' } })}' > "$CLAUDE_CONFIG_DIR/.credentials.json"
printf '%s' '${json({ oauthAccount: { accountUuid: `added-${email}`, emailAddress: email } })}' > "$CLAUDE_CONFIG_DIR/.claude.json"
`;
  await write(join(bin, 'claude'), script);
  await chmod(join(bin, 'claude'), 0o755);
}

test('adds a Claude Code account through the add-subscription modal, by pasted code', async () => {
  test.setTimeout(120_000);
  const { api, user } = await provisionedUser('desktopadd');
  const tag = user.email.split('@')[0].toLowerCase();
  const home = await machineHome(tag);
  const bin = join(home, 'bin');
  const added = `${tag}@added.e2e`;
  await fakeClaude(bin, added);

  const app = await electron.launch({
    executablePath: electronPath,
    args: [DESKTOP, '--no-sandbox'],
    env: {
      ...process.env,
      HOME: home,
      // No login shell to ask for a PATH: the one given here, fake CLI first.
      SHELL: '',
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      XDG_CONFIG_HOME: join(home, '.config'),
      CLAUDE_CONFIG_DIR: '',
      CODEX_HOME: '',
      RESETOWL_API_URL: API_URL,
    },
  });
  try {
    const page = await app.firstWindow();
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    await page.goto('app://resetowl/accounts');
    await page.getByRole('button', { name: 'Add subscription' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Claude Code/ }).click();
    await expect(dialog.getByText('Waiting for Claude…')).toBeVisible();
    // The link handed to $BROWSER is caught rather than opened, and offered.
    await expect(dialog.getByRole('button', { name: 'Open in browser' })).toBeVisible();

    // The link arrives from the CLI's output; the code path needs it.
    await dialog.getByRole('button', { name: 'Use a code instead' }).click();
    await expect(
      dialog.getByText('https://claude.com/cai/oauth/authorize?code=true&state=e2e'),
    ).toBeVisible();
    await dialog.getByLabel('2. Paste the code Claude shows you').fill('e2e-pasted-code');
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Account added')).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toBeHidden();

    // The new login lives in a folder of its own, and the collector synced it.
    await expect
      .poll(
        async () => {
          const accounts: SyncedAccount[] = await (
            await api.get(`${API_URL}/api/v1/accounts`)
          ).json();
          return accounts.find((account) => account.email === added)?.provider ?? null;
        },
        { timeout: 60_000 },
      )
      .toBe('claude-code');
  } finally {
    await app.close();
    await api.dispose();
  }
});

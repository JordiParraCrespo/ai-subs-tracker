import {
  claudeUsageBody,
  codexUsageBody,
  FakeMachine,
  grokBillingBody,
  HOSTILE_BODIES,
  reply,
} from '@flama/usage-providers/testing';
import { expect, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { launchDesktop, signInToDesktop } from '../../support/desktop';
import { startFakeVendors } from '../../support/vendors';
import { provisionedUser } from '../../support/web';

/**
 * The desktop app reading limits from the vendors, end to end: the build that
 * ships, logins on disk whose tokens are still good, and every vendor's usage
 * endpoint answered by the suite (`support/vendors.ts`). The other desktop
 * spec keeps its logins lapsed so no vendor is asked; this one is the path it
 * leaves out, which is the product: a number from a vendor, on a screen.
 *
 * What is protected: what each vendor reports reaches the API and the
 * screens, each credential is sent to the vendor that issued it and nowhere
 * else, the app names itself honestly, and a vendor failing costs only the
 * login it failed for. No credential here is real and nothing leaves the
 * machine: a request to any other host is refused and counted.
 */

interface SyncedAccount {
  provider: string;
  email: string | null;
  planName: string | null;
  latest: {
    status: string;
    windows: Array<{ kind: string; utilization: number | null }>;
  } | null;
}

const weekly = (account: SyncedAccount | undefined) =>
  account?.latest?.windows.find((window) => window.kind === 'weekly')?.utilization;

test('limits every vendor reports reach the API and the screens, each credential only at its vendor', async () => {
  test.setTimeout(120_000);
  const { api, user } = await provisionedUser('desktoplive');
  const tag = user.email.split('@')[0].toLowerCase();
  const machine = await FakeMachine.create();
  const used = [{ model: 'claude-opus-4-1', input: 20_000, output: 3_000 }];
  const home = await machine.claude({
    name: tag,
    subscriptionType: 'max',
    rateLimitTier: 'default_claude_max_20x',
    used,
  });
  const work = await machine.claude({ name: `${tag}-work`, dir: 'work', used });
  const codex = await machine.codex({ name: tag, used: [{ input: 9_000, output: 400 }] });
  const grok = await machine.grok({ name: tag });
  const server = await startFakeVendors();
  server.vendors
    .set('anthropic', home.credential, reply.json(claudeUsageBody({ session: 37, weekly: 61 })))
    .set('anthropic', work.credential, reply.json(claudeUsageBody({ session: 5, weekly: 9 })))
    .set('openai', codex.credential, reply.json(codexUsageBody({ session: 44, weekly: 22 })))
    .set('xai', grok.credential, reply.json(grokBillingBody({ weekly: 73 })));

  const { app, page } = await launchDesktop(machine.home);
  try {
    await server.route(app);
    await signInToDesktop(page, user);

    let accounts: SyncedAccount[] = [];
    await expect
      .poll(
        async () => {
          accounts = await (await api.get(`${API_URL}/api/v1/accounts`)).json();
          return accounts.map((account) => `${account.email} ${account.latest?.status}`).sort();
        },
        { timeout: 60_000 },
      )
      .toEqual(
        [home.email, work.email, codex.email, grok.email].map((email) => `${email} ok`).sort(),
      );
    const byEmail = (email: string) => accounts.find((account) => account.email === email);
    expect(weekly(byEmail(home.email))).toBe(61);
    expect(weekly(byEmail(work.email))).toBe(9);
    expect(weekly(byEmail(codex.email))).toBe(22);
    expect(weekly(byEmail(grok.email))).toBe(73);
    expect(byEmail(home.email)?.planName).toBe('Ultra');
    expect(byEmail(codex.email)?.planName).toBe('Plus');

    // The same numbers, on the screens.
    await page.goto('app://resetowl/accounts/claude-code');
    const card = page.locator('.ds-card').filter({ hasText: home.email });
    await expect(card.getByText('61%', { exact: true })).toBeVisible();
    await page.goto('app://resetowl/accounts/grok');
    await expect(
      page.locator('.ds-card').filter({ hasText: grok.email }).getByText('73%', { exact: true }),
    ).toBeVisible();

    // What the app sent, to whom, and as whom.
    const { vendors } = server;
    expect(vendors.audit({ userAgent: /^resetowl-desktop\/\d+\.\d+\.\d+ \(\w+\)$/ })).toEqual([]);
    const sentTo = (credential: string) => [
      ...new Set(vendors.requests.filter((r) => r.credential === credential).map((r) => r.vendor)),
    ];
    expect(sentTo(home.credential)).toEqual(['anthropic']);
    expect(sentTo(work.credential)).toEqual(['anthropic']);
    expect(sentTo(codex.credential)).toEqual(['openai']);
    expect(sentTo(grok.credential)).toEqual(['xai']);
    // Nothing went to any other host.
    expect(vendors.requests.filter((request) => request.vendor === null)).toEqual([]);
    // And no credential reached ResetOwl's own API.
    const stored = JSON.stringify(accounts);
    for (const credential of machine.credentials) expect(stored).not.toContain(credential);
  } finally {
    await app.close();
    await server.close();
    await api.dispose();
    await machine.dispose();
  }
});

test('a vendor failing costs only the login it failed for', async () => {
  test.setTimeout(120_000);
  const { api, user } = await provisionedUser('desktopchaos');
  const tag = user.email.split('@')[0].toLowerCase();
  const machine = await FakeMachine.create();
  const home = await machine.claude({ name: tag });
  const work = await machine.claude({ name: `${tag}-work`, dir: 'work' });
  const codex = await machine.codex({ name: tag });
  const grok = await machine.grok({ name: tag });
  const outOfRange = HOSTILE_BODIES.find((body) => body.name === 'numbers out of every range');
  const server = await startFakeVendors();
  server.vendors
    // An answer no schema describes: it must not cost the whole sync.
    .set('anthropic', home.credential, reply.json(outOfRange?.body))
    .set('anthropic', work.credential, reply.status(429))
    .set('openai', codex.credential, reply.text('<html>Bad gateway</html>', 502))
    .set('xai', grok.credential, reply.json(grokBillingBody({ weekly: 12 })));

  const { app, page } = await launchDesktop(machine.home);
  try {
    await server.route(app);
    await signInToDesktop(page, user);
    await expect
      .poll(
        async () => {
          const accounts: SyncedAccount[] = await (
            await api.get(`${API_URL}/api/v1/accounts`)
          ).json();
          return accounts.map((account) => `${account.email} ${account.latest?.status}`).sort();
        },
        { timeout: 60_000 },
      )
      .toEqual(
        [
          `${home.email} ok`,
          `${work.email} rate_limited`,
          `${codex.email} error`,
          `${grok.email} ok`,
        ].sort(),
      );
    expect(server.vendors.audit()).toEqual([]);
  } finally {
    await app.close();
    await server.close();
    await api.dispose();
    await machine.dispose();
  }
});

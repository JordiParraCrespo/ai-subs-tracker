import { expect, type Page, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { fleet, syncFleet } from '../../support/accounts';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Every screen over a machine's worth of accounts in every state at once:
 * each provider healthy, every failure status, a plan the catalog does not
 * know, a login with no reading, usage past 100%, a reset already behind us,
 * names at the contract's lengths and markup where a name belongs. What is
 * protected: no screen crashes, logs an error or runs a vendor's text as
 * markup, whatever mix of accounts a real machine reports. A screen that
 * assumes a healthy reading, a known plan or a short name fails here.
 */

/** Every signed-in route, with a heading only that route shows. */
const ROUTES: ReadonlyArray<{ path: string; heading: RegExp }> = [
  { path: '/dashboard', heading: /^Good (morning|afternoon|evening)/ },
  { path: '/accounts', heading: /^Subscriptions$/ },
  { path: '/accounts/claude-code', heading: /Claude Code accounts/ },
  { path: '/accounts/codex', heading: /Codex accounts/ },
  { path: '/accounts/grok', heading: /Grok Build accounts/ },
  { path: '/tokenmaxx', heading: /^Tokenmaxx$/ },
  { path: '/usage', heading: /^Usage & tokens$/ },
  { path: '/people', heading: /^People$/ },
  { path: '/renewals', heading: /^Renewals$/ },
];

/** Collects what a healthy page never produces. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

/**
 * Moves to `path` inside the app, as a click on a link does. A full load asks
 * the API for the session, the profile and the accounts again; ten of those
 * per test would spend the API's per-address rate limit for every spec
 * running beside this one.
 */
async function visit(page: Page, path: string) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

async function settled(page: Page, heading: RegExp) {
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  // Markup that arrived as data stays data.
  expect(
    await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
  ).toBeUndefined();
  // Nothing spills past the window: a long name wraps or is cut, it does not scroll the page.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1);
}

test('every screen draws a fleet of accounts in every state', async ({ page }) => {
  test.setTimeout(180_000);
  const { user, api } = await provisionedUser('fleet');
  const tag = user.email.split('@')[0].toLowerCase();
  const accounts = fleet(tag);
  const synced = await syncFleet(api, accounts);
  expect(synced.status(), await synced.text()).toBe(200);
  expect(await synced.json()).toHaveLength(accounts.length);

  const problems = watch(page);
  await signInAs(page, user);
  for (const route of ROUTES) {
    await test.step(route.path, async () => {
      await visit(page, route.path);
      await settled(page, route.heading);
    });
  }

  // What the fleet holds is on the screens, not only tolerated by them.
  await visit(page, '/accounts/claude-code');
  await expect(page.getByText(`ultra.${tag}@fleet.e2e`).first()).toBeVisible();
  // The account named in markup is there too, as text (the API strips the tags on the way in).
  await expect(page.getByText(/__xss/).first()).toBeVisible();
  await visit(page, '/accounts/codex');
  await expect(page.getByText(`limited.${tag}@fleet.e2e`).first()).toBeVisible();
  await visit(page, '/accounts/grok');
  await expect(page.getByText(`heavy.${tag}@fleet.e2e`).first()).toBeVisible();

  expect(problems).toEqual([]);
  await api.dispose();
});

test('every screen draws the same fleet at phone width and in the dark', async ({ page }) => {
  test.setTimeout(180_000);
  const { user, api } = await provisionedUser('fleetphone');
  const tag = user.email.split('@')[0].toLowerCase();
  expect((await syncFleet(api, fleet(tag))).status()).toBe(200);

  const problems = watch(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await signInAs(page, user);
  for (const route of ROUTES) {
    await test.step(route.path, async () => {
      await visit(page, route.path);
      await settled(page, route.heading);
    });
  }
  expect(problems).toEqual([]);
  await api.dispose();
});

test('every screen draws for an account with nothing on it', async ({ page }) => {
  test.setTimeout(120_000);
  const { user, api } = await provisionedUser('fleetempty');
  expect(await (await api.get(`${API_URL}/api/v1/accounts`)).json()).toEqual([]);

  const problems = watch(page);
  await signInAs(page, user);
  for (const route of ROUTES) {
    await test.step(route.path, async () => {
      await visit(page, route.path);
      await settled(page, route.heading);
    });
  }
  expect(problems).toEqual([]);
  await api.dispose();
});

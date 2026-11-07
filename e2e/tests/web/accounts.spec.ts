import { expect, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { syncTwoAccounts } from '../../support/accounts';
import { provisionedUser, reloadFromServer, signInAs } from '../../support/web';

/**
 * The ResetOwl screens over what a desktop collector synced. Every check reads
 * back from the API: the data arrives through `POST /accounts/sync`, the same
 * route the desktop app uses.
 */

test('the overview prices the plans the providers reported', async ({ page }) => {
  const { user, api } = await provisionedUser('overview');
  expect((await syncTwoAccounts(api)).ok()).toBe(true);
  await signInAs(page, user);

  // Ultra ($200, the renamed Max 20x) + Plus ($20).
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ }),
  ).toBeVisible();
  await expect(page.getByText('$220', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Use Codex · Plus before it resets/ })).toBeVisible();

  await api.dispose();
});

test('tokenmaxx picks the headroom that expires first and switches to it', async ({ page }) => {
  const { user, api } = await provisionedUser('tokenmaxx');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/tokenmaxx');
  // Codex Plus resets in hours with most of its week left: use it or lose it.
  await expect(page.getByText('Use next')).toBeVisible();
  await expect(page.getByText('Codex · Plus').first()).toBeVisible();
  await page.getByRole('button', { name: 'Switch to it' }).click();
  await expect(page.getByRole('button', { name: 'In use' })).toBeVisible();

  // The switch came back from the server, and only for that account.
  await reloadFromServer(page);
  await page.goto('/accounts/codex');
  await expect(page.getByText('In use').first()).toBeVisible();
  await page.goto('/accounts/claude-code');
  await expect(page.getByRole('button', { name: 'Use', exact: true }).first()).toBeVisible();

  await api.dispose();
});

test('an account can be renamed and priced', async ({ page }) => {
  const { user, api } = await provisionedUser('accountedit');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  // The Claude Code page holds the one Claude login, work@example.com.
  await page.goto('/accounts/claude-code');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('Name').fill('Work');
  await page.getByLabel('Monthly price (USD)').fill('180');
  await page.getByRole('button', { name: 'Save' }).click();

  await reloadFromServer(page);
  await page.goto('/accounts');
  await expect(page.getByText('Work', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('$180').first()).toBeVisible();

  await api.dispose();
});

test('usage shows tokens by model at API prices', async ({ page }) => {
  const { user, api } = await provisionedUser('usage');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/usage?days=7');
  await expect(page.getByRole('heading', { name: 'Usage & tokens' })).toBeVisible();
  await expect(page.getByText('Claude Opus 5.5')).toBeVisible();

  await api.dispose();
});

test('people are humans, each holding the accounts named for them', async ({ page }) => {
  const { user, api } = await provisionedUser('people');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/people');
  await expect(page.getByRole('heading', { name: 'People', level: 1 })).toBeVisible();
  // Two logins with two emails, and nobody else named: one person, the owner.
  await expect(page.getByText('Showing 1 of 1 people')).toBeVisible();
  await page.getByText('You · 2 accounts').click();
  await expect(page.getByText('work@example.com', { exact: true })).toBeVisible();
  await expect(page.getByText('home@example.com', { exact: true })).toBeVisible();
  await expect(page.getByText('Claude Code · Ultra')).toBeVisible();

  // Giving one account to someone else makes them a person of their own.
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('Used by').fill('Ana');
  await page.getByRole('button', { name: 'Save' }).click();

  await reloadFromServer(page);
  await page.goto('/people');
  await expect(page.getByText('Showing 2 of 2 people')).toBeVisible();
  await expect(page.getByText('Ana', { exact: true })).toBeVisible();

  await api.dispose();
});

test('a renewal day puts the plan on the renewals calendar', async ({ page }) => {
  const { user, api } = await provisionedUser('renewals');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/renewals');
  // Claude Code's login reports no billing day, so its plan starts unscheduled.
  await expect(page.getByText('No renewal day yet')).toBeVisible();
  await page.getByRole('button', { name: 'Set day' }).first().click();
  await page.getByLabel('Renews on day of month').fill('28');
  await page.getByRole('button', { name: 'Save' }).click();

  await reloadFromServer(page);
  await expect(page.getByRole('heading', { name: 'Next 30 days' })).toBeVisible();
  await expect(page.locator('.ds-cal__event').first()).toBeVisible();

  await api.dispose();
});

test('a calendar day puts a plan on it, or adds a subscription that bills on it', async ({
  page,
}) => {
  const { user, api } = await provisionedUser('renewalday');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/renewals');
  const days = page.getByRole('button', { name: /^Add a subscription on / });
  // The 15th: Claude Code's plan is waiting for a day, so the dialog offers it.
  await days.nth(14).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /^Renews on .*15/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Put here' }).click();
  await expect(page.getByText('No renewal day yet')).toHaveCount(0);

  await reloadFromServer(page);
  await page.goto('/renewals');
  // Both plans are on the calendar now, one row each.
  await expect(page.locator('.ds-cal__event')).toHaveCount(2);

  // No plan waits for a day now: a click is Add subscription, with the day filled in.
  await days.nth(19).click();
  await expect(dialog.getByRole('heading', { name: 'Add subscription' })).toBeVisible();
  await dialog.getByRole('button', { name: /Z\.AI/ }).click();
  await expect(dialog.getByLabel('Renews on day of month')).toHaveValue('20');

  await api.dispose();
});

test('a billing day the Codex login reports is on the calendar, and the person can override it', async ({
  page,
}) => {
  const { user, api } = await provisionedUser('renewalreported');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/renewals');
  const upcoming = page.getByRole('button', { name: /Codex · Plus/ });
  await expect(upcoming).toContainText(/Day from Codex · /);
  // Only Claude Code is still waiting for a day.
  await expect(page.getByRole('button', { name: 'Set day' })).toHaveCount(1);

  // The reported day is a suggestion: the field stays empty and says where it came from.
  await upcoming.click();
  const day = page.getByLabel('Renews on day of month');
  await expect(day).toHaveValue('');
  await expect(day).toHaveAttribute('placeholder', /as your Codex login reports/);
  await day.fill('28');
  await page.getByRole('button', { name: 'Save' }).click();

  await reloadFromServer(page);
  await page.goto('/renewals');
  await expect(page.getByText(/Day from Codex/)).toHaveCount(0);

  await api.dispose();
});

test('in a browser, adding a subscription says the desktop app signs it in', async ({ page }) => {
  const { user, api } = await provisionedUser('addbrowser');
  await signInAs(page, user);
  // A slow account list. Regression: the button was offered while the list
  // loaded, and the empty state that replaced the page then unmounted the
  // dialog it had opened. It failed only when CI was loaded enough to be slow.
  // Without the persisted query cache, so the page really waits for the list.
  await page.evaluate(() => localStorage.clear());
  await page.route(/\/api\/v1\/accounts(\?.*)?$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  const listed = page.waitForResponse(/\/api\/v1\/accounts(\?.*)?$/);
  await page.goto('/accounts');

  await page.getByRole('button', { name: 'Add subscription' }).first().click();
  // The dialog must still be open once the list has arrived.
  await listed;
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add subscription' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Codex/ })).toBeVisible();
  await dialog.getByRole('button', { name: /Claude Code/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Add it from the desktop app' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog.getByRole('heading', { name: 'Add subscription' })).toBeVisible();

  await api.dispose();
});

test('a Z.AI Coding Plan is added by hand and its usage recorded', async ({ page }) => {
  const { user, api } = await provisionedUser('zaiadd');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  // Works in a browser too: there is nothing to sign in to on the machine.
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Add subscription' }).click();
  await page.getByRole('button', { name: /Z\.AI/ }).click();
  await expect(page.getByText('No API key needed')).toBeVisible();

  // Pro has no published price, so the form asks for the one paid.
  await page.getByLabel('Name', { exact: true }).fill('GLM side project');
  await page.locator('#add-manual-account-plan').click();
  await page.getByRole('option', { name: /^Pro/ }).click();
  await expect(page.getByText('No list price is published for this tier')).toBeVisible();
  await page.getByLabel('Monthly price (USD)').fill('72');
  await page.getByLabel('Renews on day of month').fill('9');
  await page.getByRole('button', { name: 'Add subscription' }).last().click();
  await expect(page.getByText('Subscription added')).toBeVisible();

  await reloadFromServer(page);
  await page.goto('/accounts/zai');
  await expect(page.getByText('GLM side project').first()).toBeVisible();
  // No terminal switch for a plan with no login on the machine.
  await expect(page.getByRole('button', { name: 'Use', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await page.getByLabel('Weekly allowance used (%)').fill('35');
  await page.getByRole('button', { name: 'Record', exact: true }).last().click();
  await expect(page.getByText('Usage recorded')).toBeVisible();

  await reloadFromServer(page);
  await page.goto('/accounts');
  await expect(page.getByText('Z.AI · Pro').first()).toBeVisible();
  await expect(page.getByText('$72').first()).toBeVisible();
  await expect(page.getByText('recorded by you').first()).toBeVisible();

  await api.dispose();
});

test('a GLM plan read from its unofficial endpoint says so, and the reader is the desktop app’s', async ({
  page,
}) => {
  const { user, api } = await provisionedUser('glmreader');
  const created = await api.post(`${API_URL}/api/v1/accounts`, {
    data: {
      provider: 'bigmodel',
      label: 'CN plan',
      planId: 'bigmodel-pro',
      monthlyPriceCents: 2000,
    },
  });
  const account = await created.json();
  // What the desktop app sends after reading BigModel with the person's key.
  await api.post(`${API_URL}/api/v1/accounts/${account.id}/readings`, {
    data: {
      reportedPlan: 'pro',
      snapshot: {
        capturedAt: new Date().toISOString(),
        source: 'unofficial',
        status: 'ok',
        message: null,
        windows: [
          {
            key: 'weekly',
            kind: 'weekly',
            label: 'Weekly',
            utilization: 30,
            resetsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
            windowMinutes: 10080,
          },
        ],
        extraUsage: null,
      },
    },
  });
  await signInAs(page, user);

  await page.goto('/accounts/bigmodel');
  await expect(page.getByText('CN plan').first()).toBeVisible();
  await expect(page.getByText('Read from BigModel’s unofficial usage endpoint')).toBeVisible();

  // In a browser there is no key store and no reader: the dialog says where it runs.
  await page.getByRole('button', { name: 'Turn on', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Unofficial endpoint')).toBeVisible();
  await expect(dialog.getByText('runs in the ResetOwl desktop app')).toBeVisible();
  await expect(dialog.getByLabel(/API key/)).toHaveCount(0);

  await api.dispose();
});

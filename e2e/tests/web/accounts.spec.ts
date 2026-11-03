import { expect, test } from '@playwright/test';
import { syncTwoAccounts } from '../../support/accounts';
import { provisionedUser, reloadFromServer, signInAs } from '../../support/web';

/**
 * The Subtrack screens over what a desktop collector synced. Every check reads
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

test('people groups the plans by the identity that holds them', async ({ page }) => {
  const { user, api } = await provisionedUser('people');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/people');
  await expect(page.getByRole('heading', { name: 'People', level: 1 })).toBeVisible();
  // Two logins, two identities, and a row opens to the plan it holds.
  await expect(page.getByText('Showing 2 of 2 people')).toBeVisible();
  await page.getByText('work@example.com', { exact: true }).click();
  await expect(page.getByText('Claude Code · Ultra')).toBeVisible();

  await api.dispose();
});

test('a renewal day puts the plan on the renewals calendar', async ({ page }) => {
  const { user, api } = await provisionedUser('renewals');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/renewals');
  // Providers do not report a billing day, so a paid plan starts unscheduled.
  await expect(page.getByText('No renewal day yet')).toBeVisible();
  await page.getByRole('button', { name: 'Set day' }).first().click();
  await page.getByLabel('Renews on day of month').fill('28');
  await page.getByRole('button', { name: 'Save' }).click();

  await reloadFromServer(page);
  await expect(page.getByRole('heading', { name: 'Next 30 days' })).toBeVisible();
  await expect(page.locator('.ds-cal__event').first()).toBeVisible();

  await api.dispose();
});

test('in a browser, adding a subscription says the desktop app signs it in', async ({ page }) => {
  const { user, api } = await provisionedUser('addbrowser');
  await signInAs(page, user);
  await page.goto('/accounts');

  await page.getByRole('button', { name: 'Add subscription' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add subscription' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Codex/ })).toBeVisible();
  await dialog.getByRole('button', { name: /Claude Code/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Add it from the desktop app' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog.getByRole('heading', { name: 'Add subscription' })).toBeVisible();

  await api.dispose();
});

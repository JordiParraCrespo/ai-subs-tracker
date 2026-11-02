import { expect, test } from '@playwright/test';
import { syncTwoAccounts } from '../../support/accounts';
import { clickRowAction, provisionedUser, reloadFromServer, signInAs } from '../../support/web';

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
  await expect(page.getByText('$220', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Hello/ })).toBeVisible();
  await expect(page.getByText('Use it before it resets')).toBeVisible();

  await api.dispose();
});

test('tokenmaxx picks the headroom that expires first and switches to it', async ({ page }) => {
  const { user, api } = await provisionedUser('tokenmaxx');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/tokenmaxx');
  await expect(page.getByText('Use next')).toBeVisible();
  await expect(page.getByText('home@example.com').first()).toBeVisible();
  await page.getByRole('button', { name: 'Use this account' }).click();
  await expect(page.getByRole('button', { name: 'In use' })).toBeVisible();

  await reloadFromServer(page);
  await expect(
    page.getByRole('switch', { name: 'Use home@example.com in terminals' }),
  ).toBeChecked();
  await expect(
    page.getByRole('switch', { name: 'Use work@example.com in terminals' }),
  ).not.toBeChecked();

  await api.dispose();
});

test('an account can be renamed and priced', async ({ page }) => {
  const { user, api } = await provisionedUser('accountedit');
  await syncTwoAccounts(api);
  await signInAs(page, user);

  await page.goto('/accounts');
  const row = page.getByRole('row').filter({ hasText: 'work@example.com' });
  await clickRowAction(page, row, 'Edit');
  await page.getByLabel('Name').fill('Work');
  await page.getByLabel('Monthly price (USD)').fill('180');
  await page.getByRole('button', { name: 'Save' }).click();

  await reloadFromServer(page);
  const renamed = page.getByRole('row').filter({ hasText: 'Work' });
  await expect(renamed).toContainText('$180');

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

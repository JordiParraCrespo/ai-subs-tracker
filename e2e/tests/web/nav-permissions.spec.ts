import { expect, type Page, test } from '@playwright/test';
import { syncTwoAccounts } from '../../support/accounts';
// flama:begin organizations
// flama:end organizations
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The sidebar shows only the routes the signed-in user's permissions can reach,
 * end to end. Each row's visibility is decided by the same effective ability the
 * API's `PoliciesGuard` checks (served by `GET /users/me/permissions`), so this
 * asserts against the real permission set of two accounts — not a stub.
 *
 * Every row in `apps/web/src/lib/nav.ts` is ungated today: the dashboard reads
 * only the caller's own profile, and every user's Settings are their own. So an owner and a plain member are offered the same two rows,
 * and a permission set that arrives late or not at all must not take either
 * away. The first gated row adds its hidden-for-a-member case here.
 */

/** The primary nav landmark, addressed by its accessible name. */
function primaryNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main navigation' });
}

test('an owner sees every route', async ({ page }) => {
  const owner = await provisionedUser('navowner');
  await signInAs(page, owner.user);

  const nav = primaryNav(page);
  for (const label of [
    'Overview',
    'Subscriptions',
    'People',
    'Usage & tokens',
    'Tokenmaxx',
    'Renewals',
  ]) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }

  await owner.api.dispose();
});

// flama:begin organizations
// flama:end organizations

test('the command palette offers the same destinations as the sidebar', async ({ page }) => {
  const owner = await provisionedUser('navpalette');
  await signInAs(page, owner.user);

  await page.getByRole('button', { name: 'Search' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (const label of [
    'Overview',
    'Subscriptions',
    'People',
    'Usage & tokens',
    'Tokenmaxx',
    'Renewals',
    'Settings',
  ]) {
    await expect(dialog.getByRole('option', { name: label })).toBeVisible();
  }

  await dialog.getByRole('option', { name: 'Tokenmaxx' }).click();
  await expect(page).toHaveURL(/\/tokenmaxx/);

  await owner.api.dispose();
});

test('⌘K finds a subscription by what it is called, and opens its page', async ({ page }) => {
  const { user, api } = await provisionedUser('navsearch');
  await syncTwoAccounts(api);
  await signInAs(page, user);
  await page.goto('/dashboard');
  // The shortcut is the shell's: let it mount before pressing it.
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();

  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('option', { name: /Claude Code/ })).toBeVisible();

  await dialog.getByRole('combobox').fill('codex');
  await expect(dialog.getByRole('option', { name: /Codex/ })).toBeVisible();
  await expect(dialog.getByRole('option', { name: /Claude Code/ })).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/accounts\/codex/);
  await expect(dialog).toBeHidden();

  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('dialog').getByRole('combobox').fill('nothing like this');
  await expect(
    page.getByRole('dialog').getByText('No results for “nothing like this”'),
  ).toBeVisible();

  await api.dispose();
});

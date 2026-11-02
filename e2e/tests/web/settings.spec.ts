import { expect, type Page, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The settings screen, end to end.
 *
 * Every assertion goes through the real API: a save is followed by a reload, so
 * a test only passes if the value came back from the server rather than from
 * the component state that wrote it.
 */

async function openSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
}

test('lists every section', async ({ page }) => {
  const { user, api } = await provisionedUser('settings');
  await signInAs(page, user);
  await openSettings(page);

  // Every section is a card on the one page, in the design's single column.
  // flama:begin organizations
  // flama:end organizations
  await expect(page.getByRole('heading', { name: 'This computer', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Security', level: 2 })).toBeVisible();

  await api.dispose();
});

test('a section is deep-linkable', async ({ page }) => {
  const { user, api } = await provisionedUser('settingslink');
  await signInAs(page, user);

  await page.goto('/settings?section=security');

  await expect(page.getByRole('heading', { name: 'Security', level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/section=security/);

  await api.dispose();
});

test('survives a warm start with a persisted query cache', async ({ page }) => {
  // Regression guard: the profile/session entities carry behaviour and Date
  // values that do not survive the JSON round-trip into local storage.
  // Restored as plain objects, the session date made Intl throw "Invalid time
  // value", so these queries are kept out of the persisted cache.
  const { user, api } = await provisionedUser('settingswarm');
  await signInAs(page, user);

  await page.goto('/settings?section=security');
  await expect(page.getByRole('heading', { name: 'Security', level: 2 })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Security', level: 2 })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();
  await expect(page.getByText('Something went wrong!')).toBeHidden();

  await api.dispose();
});

test('Security shows this device among the account’s sessions', async ({ page }) => {
  const { user, api } = await provisionedUser('settingssec');
  await signInAs(page, user);
  await openSettings(page);

  await expect(page.getByRole('heading', { name: 'Active sessions', level: 3 })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();

  await api.dispose();
});

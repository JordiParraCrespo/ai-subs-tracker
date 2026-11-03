import { expect, type Page, test } from '@playwright/test';
import { provisionedUser, reloadFromServer, signInAs } from '../../support/web';

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
  for (const name of ['Profile', 'Security', 'Workspace', 'Language', 'Appearance']) {
    await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'This computer', level: 2 })).toBeVisible();

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

  await openSettings(page);
  await page.getByRole('button', { name: 'Manage' }).click();
  await expect(page.getByRole('dialog').getByText('This device')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Manage' }).click();
  await expect(page.getByRole('dialog').getByText('This device')).toBeVisible();
  await expect(page.getByText('Something went wrong!')).toBeHidden();

  await api.dispose();
});

test('names the workspace, which the sidebar and the page then show', async ({ page }) => {
  const { user, api } = await provisionedUser('settingsws');
  await signInAs(page, user);
  await openSettings(page);

  const name = page.getByLabel('Workspace name');
  await expect(name).toHaveValue('');
  await name.fill('Side projects');
  await name.blur();
  await expect(page.getByText('Workspace renamed')).toBeVisible();

  // The account card puts the workspace over the person once it has a name.
  const account = page.getByRole('button', { name: 'Profile' });
  await expect(account.getByText('Side projects')).toBeVisible();
  await expect(account.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();

  await reloadFromServer(page);
  await expect(page.getByLabel('Workspace name')).toHaveValue('Side projects');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByText('Side projects').first()).toBeVisible();

  // An emptied field clears the name rather than saving a blank one.
  await page.getByLabel('Workspace name').fill('');
  await page.getByLabel('Workspace name').blur();
  await expect(page.getByText('Workspace renamed')).toBeVisible();
  await reloadFromServer(page);
  await expect(page.getByLabel('Workspace name')).toHaveValue('');

  await api.dispose();
});

test('repaints on the dark theme, and the server remembers the choice', async ({ page }) => {
  const { user, api } = await provisionedUser('settingstheme');
  await signInAs(page, user);
  await openSettings(page);

  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await reloadFromServer(page);
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveClass(/light/);

  await api.dispose();
});

test('switches the language of the whole page', async ({ page }) => {
  const { user, api } = await provisionedUser('settingslang');
  await signInAs(page, user);
  await openSettings(page);

  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page.getByRole('heading', { name: 'Idioma', level: 2 })).toBeVisible();

  // The saved locale is the account's default on a device that has not
  // chosen for itself: a fresh context signs in and reads a Spanish page.
  const fresh = await page.context().browser()?.newContext();
  if (fresh) {
    const other = await fresh.newPage();
    await signInAs(other, user);
    await expect(other.getByRole('link', { name: 'Resumen', exact: true })).toBeVisible();
    await fresh.close();
  }

  await api.dispose();
});

test('two cards saved back to back both keep their change', async ({ page }) => {
  // Each card saves the whole settings record: without saves running in
  // order and carrying the change still in flight, the theme's save sent the
  // old language back and undid the first.
  const { user, api } = await provisionedUser('settingsrace');
  await signInAs(page, user);
  await openSettings(page);

  // Hold the first save's answer, so the second card saves while it is in flight.
  let held = false;
  await page.route('**/api/v1/profile/settings', async (route) => {
    if (route.request().method() === 'PUT' && !held) {
      held = true;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Español' }).click();
  await page.getByRole('radio', { name: 'Oscuro' }).click();

  await expect
    .poll(async () => {
      const settings = await (await api.get('/api/v1/profile/settings')).json();
      return `${settings.locale} ${settings.theme}`;
    })
    .toBe('es dark');

  await api.dispose();
});

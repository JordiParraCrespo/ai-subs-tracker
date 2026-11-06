import { expect, type Page, test } from '@playwright/test';
import { totpCode } from '../../support/totp';
import { loginThroughUi, provisionedUser, reloadFromServer, signInAs } from '../../support/web';

/**
 * The person's own account in Settings, end to end: the Profile card and the
 * Security dialog it opens.
 *
 * Every assertion goes through the real API: a save is followed by
 * `reloadFromServer`, so a test only passes if the value came back from the
 * server rather than from the component state that wrote it. Each spec mints
 * its own account, so nothing here contends with another test's rows.
 */

async function openSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible({
    timeout: 30_000,
  });
}

/** Opens the Security dialog from its card. */
async function openSecurity(page: Page) {
  await page.getByRole('button', { name: 'Manage' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Security' })).toBeVisible();
  return dialog;
}

/** Every device row of the Security dialog. */
function deviceRows(page: Page) {
  return page.getByRole('dialog').getByTestId('device-row');
}

test('the old profile URL lands on Settings', async ({ page }) => {
  const { user, api } = await provisionedUser('profileurl');
  await signInAs(page, user);
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { name: 'Profile', level: 2 })).toBeVisible();
  await api.dispose();
});

test.describe('the profile card', () => {
  test('fills itself from the saved account and keeps the email read-only', async ({ page }) => {
    const { user, api } = await provisionedUser('profileform');
    await signInAs(page, user);
    await openSettings(page);

    await expect(page.getByLabel('First name')).toHaveValue(user.firstName);
    await expect(page.getByLabel('Last name')).toHaveValue(user.lastName);
    await expect(page.getByLabel('Email')).toHaveValue(user.email);
    await expect(page.getByLabel('Email')).toHaveAttribute('readonly', '');

    await api.dispose();
  });

  test('saves a name as the field is left, and the server is the one that remembers it', async ({
    page,
  }) => {
    const { user, api } = await provisionedUser('profilesave');
    await signInAs(page, user);
    await openSettings(page);

    await page.getByLabel('First name').fill('Renamed');
    await page.getByLabel('First name').blur();
    await expect(page.getByText('Profile saved')).toBeVisible();

    // The shell reads the name from its own query; renaming has to reach it.
    await expect(
      page.getByRole('button', { name: 'Profile' }).getByText(`Renamed ${user.lastName}`),
    ).toBeVisible();

    await reloadFromServer(page);
    await expect(page.getByLabel('First name')).toHaveValue('Renamed');

    await api.dispose();
  });

  test('refuses an empty name and leaves the saved one alone', async ({ page }) => {
    const { user, api } = await provisionedUser('profileempty');
    await signInAs(page, user);
    await openSettings(page);

    await page.getByLabel('Last name').fill('');
    await page.getByLabel('Last name').blur();
    await expect(page.getByLabel('Last name')).toHaveAttribute('aria-invalid', 'true');

    await reloadFromServer(page);
    await expect(page.getByLabel('Last name')).toHaveValue(user.lastName);

    await api.dispose();
  });
});

test.describe('the password', () => {
  test('says what the new password still needs before it can be saved', async ({ page }) => {
    const { user, api } = await provisionedUser('pwrules');
    await signInAs(page, user);
    await openSettings(page);
    const dialog = await openSecurity(page);
    await dialog.getByRole('button', { name: 'Change' }).click();

    const submit = dialog.locator('button[type=submit]');
    await expect(submit).toHaveText('Enter current password');
    await dialog.getByLabel('Current password').fill(user.password);
    await expect(submit).toHaveText('Use at least 8 characters');
    await dialog.getByLabel('New password', { exact: true }).fill('battery-staple');
    await expect(submit).toHaveText('Add a number');
    await dialog.getByLabel('New password', { exact: true }).fill('battery-staple-9');
    await expect(submit).toHaveText('Confirm new password');
    await dialog.getByLabel('Confirm new password').fill('battery-staple-8');
    await expect(submit).toBeDisabled();
    await dialog.getByLabel('Confirm new password').fill('battery-staple-9');
    await expect(submit).toHaveText('Change password');
    await expect(submit).toBeEnabled();

    await api.dispose();
  });

  test('reports a wrong current password in the reader’s language', async ({ page }) => {
    const { user, api } = await provisionedUser('pwwrong');
    await signInAs(page, user);
    await openSettings(page);
    const dialog = await openSecurity(page);
    await dialog.getByRole('button', { name: 'Change' }).click();

    await dialog.getByLabel('Current password').fill('not-my-password');
    await dialog.getByLabel('New password', { exact: true }).fill('battery-staple-9');
    await dialog.getByLabel('Confirm new password').fill('battery-staple-9');
    await dialog.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByText('That current password is not right.')).toBeVisible();

    await api.dispose();
  });

  test('changes the password and signs the other devices out', async ({ page, browser }) => {
    const { user, api } = await provisionedUser('pwchange');
    // A second real sign-in, so there is something for the change to revoke.
    const other = await browser.newContext();
    await signInAs(await other.newPage(), user);

    await signInAs(page, user);
    await openSettings(page);
    const dialog = await openSecurity(page);
    await dialog.getByRole('button', { name: 'Change' }).click();

    const next = 'Rotated!Password9';
    await dialog.getByLabel('Current password').fill(user.password);
    await dialog.getByLabel('New password', { exact: true }).fill(next);
    await dialog.getByLabel('Confirm new password').fill(next);
    await dialog.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText(/password updated/i).first()).toBeVisible();

    // Back on the overview, only this browser is left.
    await expect(deviceRows(page)).toHaveCount(1);

    await other.close();
    await api.dispose();
  });
});

test.describe('two-factor', () => {
  test('sets up two-factor, which the next sign-in then asks for', async ({ page }) => {
    const { user, api } = await provisionedUser('pw2fa');
    await signInAs(page, user);
    await openSettings(page);
    const dialog = await openSecurity(page);
    await expect(dialog.getByText('Off', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Set up' }).click();

    await expect(dialog.getByText('Step 1 of 3')).toBeVisible();
    await dialog.getByLabel('Password', { exact: true }).fill(user.password);
    await dialog.getByRole('button', { name: 'Continue' }).click();

    // The key printed beside the QR code, as someone who cannot scan would type it.
    await expect(dialog.getByRole('img', { name: /QR code/ })).toBeVisible();
    const secret = ((await dialog.locator('code').textContent()) ?? '').replaceAll(' ', '');
    await dialog.getByLabel('6-digit code from your app').fill(totpCode(secret));
    await dialog.getByRole('button', { name: 'Verify' }).click();

    await expect(
      dialog.getByRole('list', { name: 'Backup codes' }).getByRole('listitem'),
    ).toHaveCount(10);
    const done = dialog.getByRole('button', { name: 'Confirm you saved them' });
    await expect(done).toBeDisabled();
    await dialog.getByText('I saved these somewhere safe').click();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog.getByText('On', { exact: true })).toBeVisible();

    await page.context().clearCookies();
    await loginThroughUi(page, user.email, user.password);
    await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
    await page.getByLabel('6-digit code').fill(totpCode(secret));
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    await api.dispose();
  });
});

test.describe('the devices', () => {
  test('marks the browser reading the page, and offers no way to sign it out', async ({ page }) => {
    const { user, api } = await provisionedUser('sessions');
    await signInAs(page, user);
    await openSettings(page);
    await openSecurity(page);

    const current = deviceRows(page).filter({ hasText: 'This device' });
    await expect(current).toHaveCount(1);
    await expect(current.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    await expect(current).toContainText(/Chrome|Chromium|Safari|Firefox/);

    await api.dispose();
  });

  test('signs one other device out', async ({ page, browser }) => {
    const { user, api } = await provisionedUser('sessionsone');
    const other = await browser.newContext();
    await signInAs(await other.newPage(), user);

    await signInAs(page, user);
    await openSettings(page);
    const dialog = await openSecurity(page);

    // The API context that provisioned the account holds a session too, so
    // there are at least three rows before anything is revoked.
    await expect(deviceRows(page).first()).toBeVisible();
    const before = await deviceRows(page).count();
    expect(before).toBeGreaterThan(1);

    // A row's "Sign out" only asks; the confirm step is what revokes.
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).first().click();
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(deviceRows(page)).toHaveCount(before - 1);

    // The row is gone because the server dropped it, not because the list
    // re-rendered without it.
    await reloadFromServer(page);
    await openSecurity(page);
    await expect(deviceRows(page)).toHaveCount(before - 1);

    await other.close();
    await api.dispose();
  });

  // flama:begin api-tokens
  // flama:end api-tokens

  test('signs every other device out at once', async ({ page, browser }) => {
    const { user, api } = await provisionedUser('sessionsall');
    const other = await browser.newContext();
    await signInAs(await other.newPage(), user);

    await signInAs(page, user);
    await openSettings(page);
    const dialog = await openSecurity(page);

    await dialog.getByRole('button', { name: 'Sign out all other devices' }).click();
    await dialog.getByRole('button', { name: /^Sign out \d+ devices?$/ }).click();

    // Only the browser reading the page survives, and the button has nothing
    // left to do.
    await expect(deviceRows(page)).toHaveCount(1);
    await expect(deviceRows(page).filter({ hasText: 'This device' })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Sign out all other devices' })).toHaveCount(0);

    await reloadFromServer(page);
    await openSecurity(page);
    await expect(deviceRows(page)).toHaveCount(1);

    await other.close();
    await api.dispose();
  });
});

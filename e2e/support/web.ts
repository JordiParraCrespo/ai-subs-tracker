import { expect, type Page } from '@playwright/test';
import { signedUpContext, type TestUser } from './auth';

// flama:begin organizations
// flama:end organizations

/**
 * Helpers for the `web` project: the journeys every browser spec starts from.
 * {@link provisionedUser} signs up through the API, so a spec spends its time
 * on the screen it is about rather than on the ones before it.
 */

export async function registerThroughUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.fill('#firstName', user.firstName);
  await page.fill('#lastName', user.lastName);
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

export async function loginThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** Signs in through the real form and waits for the workspace shell. */
export async function signInAs(
  page: Page,
  user: { email: string; password: string },
): Promise<void> {
  await loginThroughUi(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

/** A fresh account the shell opens for, with a session cookie to match. */
export async function provisionedUser(prefix = 'user') {
  const { api, user, userId } = await signedUpContext(prefix);
  // flama:begin organizations
  // flama:end organizations
  return { api, user, userId };
}

/**
 * Reloads with the persisted query cache thrown away.
 *
 * TanStack Query's cache is persisted to local storage with a 60s stale window,
 * so a plain reload can re-render the values the page itself just wrote. Only a
 * reload with no cache to fall back on proves the value came from the API. The
 * session lives in an httpOnly cookie, so clearing storage does not sign the
 * reader out.
 */
export async function reloadFromServer(page: Page): Promise<void> {
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

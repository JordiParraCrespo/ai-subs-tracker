import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
} from '@playwright/test';
import { API_URL } from '../playwright.config';

/**
 * The desktop app (`apps/desktop`, built) on a home the suite made: launched
 * against the stack's API, with no real login, shell or CLI of the machine
 * running the suite in reach.
 */

const DESKTOP = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'desktop');
const electronPath = createRequire(join(DESKTOP, 'package.json'))('electron') as unknown as string;

export async function launchDesktop(
  home: string,
  env: Record<string, string> = {},
): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [DESKTOP, '--no-sandbox'],
    env: {
      ...process.env,
      HOME: home,
      // No login shell to ask for a PATH, and none of this machine's CLIs.
      SHELL: '',
      XDG_CONFIG_HOME: join(home, '.config'),
      CLAUDE_CONFIG_DIR: '',
      CODEX_HOME: '',
      GROK_HOME: '',
      RESETOWL_API_URL: API_URL,
      ...env,
    },
  });
  const page = await app.firstWindow();
  await expect(page).toHaveURL(/^app:\/\/resetowl\//);
  return { app, page };
}

/** Signs in through the app's own screens, which starts a collection. */
export async function signInToDesktop(page: Page, user: { email: string; password: string }) {
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

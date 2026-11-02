import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { syncTwoAccounts } from '../../support/accounts';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The screens photographed for a pull request: every route `pnpm screens`
 * names (in `SCREENS`), light and dark, at each width in `SCREENS_WIDTHS`.
 * Signed in as a fresh account that a desktop sync has given two plans, so a
 * screen shows data rather than its empty state; `SCREENS_EMPTY=1` skips the
 * sync, and `anon:` before a route takes it signed out. Not part of `e2e`:
 * with no `SCREENS` it has nothing to take.
 */

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.screenshots');
const routes = (process.env.SCREENS ?? '')
  .split(',')
  .map((route) => route.trim())
  .filter((route) => route && !route.startsWith('spec:'));
const widths = (process.env.SCREENS_WIDTHS ?? '1440').split(',').map(Number);
const THEMES = ['light', 'dark'] as const;

const slug = (route: string) =>
  route
    .replace(/^anon:/, 'anon-')
    .replace(/^\//, '')
    .replace(/[^\w-]+/g, '-') || 'root';

test('the named screens, light and dark', async ({ browser }) => {
  test.skip(routes.length === 0, 'no routes named: run it through `pnpm screens <route>…`');
  test.setTimeout(60_000 + routes.length * widths.length * 30_000);
  mkdirSync(OUT, { recursive: true });

  const { api, user } = await provisionedUser('screens');
  if (process.env.SCREENS_EMPTY !== '1') await syncTwoAccounts(api);
  const files: string[] = [];

  for (const width of widths) {
    for (const theme of THEMES) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript((value) => localStorage.setItem('theme', value), theme);
      const page = await context.newPage();
      let signedIn = false;
      for (const route of routes) {
        const anon = route.startsWith('anon:');
        if (!anon && !signedIn) {
          await signInAs(page, user);
          signedIn = true;
        }
        await page.goto(route.replace(/^anon:/, ''));
        await page.waitForLoadState('networkidle');
        const file = `${slug(route)}-${width}-${theme}.png`;
        await page.screenshot({ path: resolve(OUT, file), fullPage: true });
        files.push(file);
      }
      await context.close();
    }
  }

  writeFileSync(
    resolve(OUT, 'shots.json'),
    `${JSON.stringify({ routes, widths, themes: THEMES, files }, null, 2)}\n`,
  );
  await api.dispose();
});

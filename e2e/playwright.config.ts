import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end coverage for the authentication surface.
 *
 * Two projects share one runner:
 *   - `api` drives the Better Auth endpoints and the REST routes behind them
 *     with `request` only, so it needs no browser.
 *   - `web` drives `apps/web` in Chromium, exercising the same flows through
 *     the UI a user actually sees.
 *
 * Both assume the API on `API_URL` and the web app on `WEB_URL`, with the
 * Postgres from `docker compose up` reachable at `DATABASE_URL` — the tests
 * read reset/verification tokens straight out of the database and the API log
 * rather than needing a mailbox.
 */
import { chromiumPath } from '../scripts/chromium.mjs';

/** The machine's own Chromium where it ships one (`scripts/chromium.mjs`), else Playwright's. */
const CHROMIUM_PATH = chromiumPath();

export const API_URL = process.env.API_URL ?? 'http://localhost:3001';
export const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  // Auth flows mutate shared rows (sessions, verification tokens) for the user
  // under test; every test mints its own user, so files can run in parallel.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  // Every artifact lands under a directory Biome and git already ignore, so a
  // local run never leaves generated output for `pnpm check` to lint.
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // The rate-limit test deliberately trips the per-IP throttle, which would
  // then refuse every other test sharing that IP. Run it on its own with
  // `pnpm test:ratelimit`.
  grepInvert: process.env.RUN_RATE_LIMIT ? undefined : /@ratelimit/,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Recording needs the ffmpeg Playwright downloads beside its own Chromium;
    // a machine's shipped Chromium comes without it.
    video: CHROMIUM_PATH ? 'off' : 'retain-on-failure',
    launchOptions: CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : undefined,
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: API_URL },
    },
    // flama:begin web
    {
      name: 'web',
      testDir: './tests/web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_URL,
        // The web app talks to the API through Vite's `/api` proxy, so the
        // session cookie stays same-origin exactly as it does in production.
        ignoreHTTPSErrors: true,
      },
    },
    // flama:end web
    // The desktop app (Electron) against the stack: `e2e:desktop`, after
    // building @flama/web and @flama/desktop; Linux without a display needs
    // `xvfb-run -a`. One worker: each run launches the whole app.
    {
      name: 'desktop',
      testDir: './tests/desktop',
      fullyParallel: false,
    },
    // flama:begin web
    // `pnpm screens` (scripts/stack/screens.mjs): the routes it names, light
    // and dark, into `.screenshots/`. Throwaway specs for one state live in
    // `tests/screens/local/` (git-ignored) and run here too.
    {
      name: 'screens',
      testDir: './tests/screens',
      use: { ...devices['Desktop Chrome'], baseURL: WEB_URL, ignoreHTTPSErrors: true },
    },
    // flama:end web
  ],
});

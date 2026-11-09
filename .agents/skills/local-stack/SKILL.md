---
name: local-stack
description: Verify a change end to end against the real API, the screens and the desktop app, and photograph the screens for a pull request. Use it on every change that alters what the screens show (apps/web, packages/frontend/web, the web design system, the translations) to take light and dark screenshots of each screen it touches, and on any change to the API, the desktop app or the usage providers that needs more than unit tests. Use it also when asked to run the product and show it working.
---

# Verify a change end to end

## 1. Stand the stack up

```bash
node scripts/stack/stack.mjs up          # add --web when the screens are involved
```

It is the "Running it" steps of `e2e/README.md` in one command: Postgres and
Redis, then the API built from this checkout, migrated and started, with its
log in `.stack/api.log` (where the suites read the mail the API "sends"),
and with `--web` the screens through Vite, which serve this checkout's source
so later edits show without a restart. It never writes `.env`; a checkout
without one gets `.env.example`'s defaults as environment.

It does not need Docker: it uses a Postgres and a Redis already listening on
5432 and 6379, and starts them with Docker only when nothing is. On a machine
with neither (a cloud sandbox), start the local ones first, with a `flama`
role and database matching `.env.example`'s `DB_*`, and run it again. Try it
before deciding the stack cannot run here. `node scripts/stack/stack.mjs
status` says what is up.

Stop an API you started yourself first: the stack leaves anything already
answering on 3001 alone, and `pnpm ci:local` refuses an API it did not start.

## 2. Run what the change touches

| Change touches | Run |
| --- | --- |
| API routes, accounts, auth, profile | `pnpm --filter @flama/e2e e2e:api` |
| The screens, the web kit, the design system, the translations | `pnpm --filter @flama/e2e e2e:web` (stack up `--web`) |
| The desktop app, the usage providers, the sync | build `@flama/web` and `@flama/desktop`, then `pnpm --filter @flama/e2e e2e:desktop` (on Linux without a display, under `xvfb-run -a`) |

The desktop suite launches the real Electron build on a throwaway home with
Claude Code and Codex logins written to disk, signs in through the app,
waits for its collector to sync to the stack's API, and switches a login on
through the screens. It never reaches a provider, so it runs offline and
sends no credential anywhere: one spec keeps its logins lapsed so none is
asked, the other has the suite's fake vendors answer for every one
(`e2e/README.md`, "Vendors, a machine and a fleet").

Playwright uses the machine's own Chromium where it ships one
(`scripts/chromium.mjs`: `PLAYWRIGHT_CHROMIUM_PATH`, or
`/opt/pw-browsers/chromium`); there is nothing to install.

## 3. Show a visual change

Where this sits among the steps of a pull request is the `local-ci` skill.

Every change that alters what the screens show gets screenshots, taken here
and shown to the user, before its pull request is opened or updated.

1. Bring the stack up with the screens: `node scripts/stack/stack.mjs up --web`.
2. Name the routes the change shows on and photograph them:

   ```bash
   pnpm screens /dashboard /accounts anon:/login
   ```

   Each route is taken light and dark at 1440px, signed in as a fresh account
   that a desktop sync has given two plans, into `.screenshots/`
   (git-ignored) with a `manifest.json` naming the commit. `anon:` takes a
   route signed out; `--empty` skips the sync, for an empty state; `--phone`
   adds a 390px width, which a layout change needs. A component in the design
   system or the kit is photographed on a route that renders it.

   A state a route alone cannot reach (a dialog open, a row expanded) is a
   throwaway spec: write it with the Write tool to
   `e2e/tests/screens/local/<name>.spec.ts` (git-ignored) and name it among
   the routes as `spec:<name>`: `pnpm screens /accounts spec:edit-dialog`.

   ```ts
   import { test } from '@playwright/test';
   import { syncTwoAccounts } from '../../../support/accounts';
   import { provisionedUser, signInAs } from '../../../support/web';

   test('the edit dialog', async ({ page }) => {
     const { api, user } = await provisionedUser('screens');
     await syncTwoAccounts(api);
     await signInAs(page, user);
     await page.goto('/accounts/claude-code');
     await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
     await page.screenshot({ path: '../.screenshots/edit-dialog-1440-dark.png' });
   });
   ```

3. Look at every picture, then send them to the user.

## 4. Report and tear down

Report which rows you ran, what they printed, which screenshots you took,
and what you did not run and why. Then, once the branch's `pnpm ci:local` has
run (it leaves a stack up `--web` in place):

```bash
node scripts/stack/stack.mjs down
```

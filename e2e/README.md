# @flama/e2e

End-to-end coverage driven by Playwright against a running stack. Four
projects share one runner:

- **`api`** — drives the Better Auth endpoints and the REST routes behind them
  with `request` only, so it needs no browser.
- **`web`** — drives `apps/web` in Chromium, through the screens a person
  actually sees: sign-in, the accounts, usage, Tokenmaxx, People, Renewals,
  the profile and settings.
- **`desktop`** — launches the Electron app (`apps/desktop`) on a throwaway
  home with Claude Code and Codex logins written to disk, signs in through its
  screens, waits for its collector to sync to the API, and switches a login
  on, checking the pointer file the terminals read. Its logins never reach a
  provider, so it runs offline.
- **`screens`** — `pnpm screens`: the routes it names, photographed light and
  dark for a pull request. Not a test of anything; with no routes named it
  skips.

## Where it runs

CI runs the **`api` project** on every pull request, in the `End-to-End Tests
(API)` job. The **`web` and `desktop` projects** have no runner there:
`pnpm ci:local` runs them, with the `api` project, against the local stack
whenever the branch touches what they cover (`scripts/ci/e2e-stage.mjs`), so a
push is checked end to end before it leaves the machine.

## Running it

```bash
node scripts/stack/stack.mjs up --web     # Postgres, Redis, the API built here, the screens

pnpm --filter @flama/e2e e2e:api          # API only, no browser needed
pnpm --filter @flama/e2e e2e:web          # the screens
pnpm turbo run build --filter=@flama/web --filter=@flama/desktop
pnpm --filter @flama/e2e e2e:desktop      # on Linux without a display: xvfb-run -a pnpm …
pnpm --filter @flama/e2e e2e:ratelimit    # see "The rate-limit test" below

node scripts/stack/stack.mjs down
```

`scripts/stack/stack.mjs` is the steps this used to list by hand: it uses a
Postgres and a Redis already listening (or starts them with Docker), builds,
migrates and starts the API with its log in `.stack/api.log`, which is the
suites' mailbox (below), and with `--web` serves the screens through Vite. It
never writes `.env`. The `local-stack` skill is how an agent uses it.

Overridable via environment: `API_URL` (default `http://localhost:3001`),
`WEB_URL` (`http://localhost:3000`), `API_LOG` (`.stack/api.log`), and
`PLAYWRIGHT_CHROMIUM_PATH` for a Chromium the machine ships
(`scripts/chromium.mjs` also finds `/opt/pw-browsers/chromium` on its own).

Database settings are **not** a separate knob. `support/db.ts` imports
`@flama/env/load` and reads the same `DB_HOST` / `DB_PORT` / `DB_USERNAME` /
`DB_PASSWORD` / `DB_DATABASE` from the root `.env` that the API and the
migrations use, so the suite cannot end up asserting against a different
database from the one under test — which would turn every DB-backed assertion
into a meaningless pass. To point at another database, change those variables
(a real environment variable always wins over the file), exactly as you would
for the API.

## No mail server needed

Two flows depend on a link that normally arrives by email. The suite reads them
from where the API already puts them, so there is nothing to install:

- **Password reset** — the token lives in Better Auth's `verification` table,
  as `reset-password:<token>` in the `identifier` column. `support/db.ts` reads
  it.
- **Email verification** — the token is a signed JWT that is never stored, so
  `support/mail.ts` reads it out of the API log instead. With
  `EMAIL_PROVIDER=console` the API's `ConsoleEmailService` logs every message it
  would have sent, which makes the log the mailbox. That is why the stack
  captures the API's output to `.stack/api.log`, and why `API_LOG` must point
  at the file when the API runs some other way.

## Accounts and workspaces

Registering creates an account and nothing else: an account belongs to no
workspace until it creates one from `/onboarding` or accepts an invitation. The
`web` specs therefore start from `provisionedUser()` in `support/web.ts`, which
signs up **and** creates a workspace through the API, so a spec spends its time
on the screen it is about rather than on the two screens before it. Only the
specs about registration and onboarding go through those screens themselves.

Every browser spec mints its own account, so the `web` project runs fully in
parallel and nothing has to be put back afterwards.

## Two conventions worth knowing

**Every test here asserts behaviour the app actually has.** Earlier revisions
carried `test.fail()` annotations naming open security issues (#68, #111, #112);
those are fixed and the annotations are gone. If you add one for a new bug, name
the issue in it — the test then reports green while the bug is present and turns
**red when it is fixed**, which is the signal to delete the annotation.

**Requests carry an `Origin` header.** Better Auth refuses a cookie-bearing
state change that arrives without one (`MISSING_OR_NULL_ORIGIN`) — its CSRF
defence. Browsers always send one; a bare API client does not, so `newContext()`
in `support/auth.ts` sends the web app's origin, which the API trusts. A new
helper that builds its own request context needs the same header.

## The rate-limit test

`the API throttles a flood of requests @ratelimit` deliberately trips the global
per-IP limiter (100/minute), which would then refuse every other test sharing
that IP. It is excluded from the default run by `grepInvert` and has its own
script:

```bash
pnpm --filter @flama/e2e e2e:ratelimit
```

Token minting is separately throttled to 10/minute, so `mintToken` waits out a
429 rather than failing — the limiter has its own test and should not be
re-tested by accident everywhere else.

## Layout

```
e2e/
├── support/
│   ├── accounts.ts # a desktop collector's sync, sent straight to the API
│   ├── auth.ts     # request contexts, sign-up/in/out, reset helpers, problem-doc assertions
│   ├── db.ts       # reset tokens, roles, orgs, sessions, password hashes
│   ├── mail.ts     # reads the console-provider "mailbox" out of the API log
│   └── web.ts      # browser sign-in and a fresh account per spec
└── tests/
    ├── api/        # sign-up, sign-in, password reset, verification, protected
    │               # routes, authorization, session security, OAuth, accounts
    ├── web/        # the same journeys through apps/web in Chromium
    ├── desktop/    # the Electron app, its collector and the sync
    └── screens/    # `pnpm screens`; local/ holds throwaway specs (git-ignored)
```

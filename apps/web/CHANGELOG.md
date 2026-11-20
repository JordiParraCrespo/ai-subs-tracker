# @flama/web

## 1.0.0

### Major Changes

- 4ea785b: Google and GitHub sign-in leave the starter, so the apps, the kits, the API and the capabilities it reports name no social provider.
- 4ea785b: PostHog leaves the starter: the apps pass no analytics client to `FlamaApp.create`, so events go to the kernel's no-op one, and the kits no longer export a PostHog adapter.

### Minor Changes

- 4ea785b: Personal API tokens leave the starter; the API keeps the scope machinery behind a `SCOPED_CREDENTIAL` port, and `@flama/shared` derives its flag exports from whatever catalog it declares, now none.
- 69128f7: Stop idle Claude Code accounts turning into "Sign in again" after a few hours. An account nobody runs Claude in still has a valid login — only its short-lived access token lapses — so ResetOwl now lets Claude Code's own CLI renew it instead of reporting it signed out.

  `packages/usage-providers` (pure, read-only) no longer decides expiry from the stored timestamp alone: a lapsed access token whose refresh token is still good reads as the new `auth_stale` status, and only a login that cannot be renewed (no refresh token, its expiry passed, or the vendor rejected it) is `auth_expired` → "Sign in again". The provider also describes a `refreshCommand` (`claude auth status`), built from its existing `launchEnv`/`loginCommand`.

  The desktop collector (`renew-login.ts`) runs that command for a login read as `auth_stale` — stdin closed, timed out, at most one per folder at a time, backed off after a failure — so Claude Code refreshes its own access token and rewrites its credential file, then reads the login again. The default `~/.claude` is run with no `CLAUDE_CONFIG_DIR`, so the macOS Keychain item is the one a terminal would use (that Keychain write is verified only in code review here, not on Linux). ResetOwl still never calls `oauth/token` and never writes a credential itself.

  While a login is renewable-but-stale (e.g. the CLI is not installed), the API keeps showing its last good reading instead of empty bars: `GET /v1/accounts` carries forward the windows from the most recent snapshot that had them, dropping any whose reset has passed, and the screens mark the account `Stale` rather than "Sign in again".

  Follow-up to the Codex reported-billing-day and GLM unofficial-reader work; Codex is left unchanged pending verification that a Codex command renews its own token without spending usage (issue #9's open question).

- 0fbe635: Put Codex plans on the Renewals calendar without asking. The Codex reader takes the end of the paid period from the `id_token` in `auth.json` (`chatgpt_subscription_active_until`, an undocumented claim, read locally with no new request) and syncs only its day of the month, in the machine's local time, with when ChatGPT last checked the subscription (`reportedRenewal` on `POST /v1/accounts/sync`, optional so older collectors still sync). The token is reissued only when Codex refreshes its login, so the date itself can be a period or more behind; the day a plan bills does not move. The API keeps it beside the person's own day (`reportedRenewalDay`, `renewalCheckedAt`): `renewalDay` is the person's, else the reported one, and `renewalDayOverridden` says which. The edit form leaves the field empty for a reported day and shows it as the placeholder, so clearing an override falls back to the login, and Next 30 days says where a reported day came from. Claude Code reports no billing day and keeps "Set day".
- 4ea785b: Every dependency moves to its latest release, majors included: Expo SDK 58
  (React Native 0.88, React 19.3), NestJS 12, TypeORM 1, Zod 4, bullmq 6,
  ioredis 6, CASL 7, nestjs-zod 5, nestjs-pino 5, react-native-gesture-handler 3,
  better-auth 1.7. Versions on the mobile side are the ones SDK 58 lists, so
  `expo install --check` is clean.

  What a consumer has to move with:

  - **Zod 4.** The schemas in `@flama/shared` are Zod 4 schemas, and
    `createZodErrorMap` returns a Zod 4 error map (`core.$ZodErrorMap`), passed
    as `error`, not `errorMap`. The kits' `zod` peer is `^4`.
  - **NestJS 12** in every backend package, and `typeorm` `^1` as
    `@flama/backend-authz`'s peer.
  - **nestjs-zod 5** has no `patchNestJsSwagger`: the API runs the document
    through `cleanupOpenApiDoc` instead. The document now carries each schema's
    bounds and defaults, and Zod 4's `uuid()` is the RFC check, so a lookalike id
    such as `11111111-1111-1111-1111-111111111111` no longer passes.
  - **CommonJS packages resolve `node16`.** CASL 7 publishes its types only
    through `exports`, which the deprecated `node` resolution never read.
  - **React Native 0.88** types its strict API by default; the mobile tsconfigs
    select the legacy types with `react-native-legacy-deep-imports`, which
    NativeWind's `className` augmentation still targets.

  `@flama/shared` gains a `flama-source` export condition pointing at its
  TypeScript source. `apps/web` resolves it, because a CommonJS `require('zod')`
  pulls in all of Zod 4, every locale included, beside the copy the frontend
  packages import as ESM: 94KB gzipped on first load.

- 47d4885: The desktop app updates itself. It looks for a new release shortly after it
  starts and every six hours, downloads it in the background and installs it
  when the app quits. A card in the bottom corner offers "Restart now" once a
  version is ready, reports a download that failed, and after an update says
  which version it replaced. Settings › Updates shows the version and the last
  check, checks on demand, and turns installing on quit off. The tray offers
  "Restart to update". Builds that cannot replace themselves (a development
  run, a Linux install other than the AppImage) point to the download page.
- 4ea785b: Feature flags leave the starter; an app loads an optional kernel module by passing it to `FlamaApp.create({ modules })`.
- ef55a1e: Read a GLM Coding Plan's usage automatically, opt-in, and track BigModel plans. `bigmodel` joins `zai` as a manual provider, with its Lite, Pro and Max plans (no published price: the account carries the one paid, in US dollars). In the desktop app, a Z.AI or BigModel account can turn on an unofficial usage reader: the person's Coding Plan key, encrypted with `safeStorage`, reads `/api/monitor/usage/quota/limit` on the vendor's own site (undocumented; the endpoint the vendor's usage plugin calls) and the desktop sends the 5-hour, weekly and monthly MCP windows to the new `POST /v1/accounts/:id/readings`, never the key. Readings carry the source `unofficial`, the screens say so, and they lapse like hand-typed ones; recording by hand stays the fallback.
- 5028983: Track Grok Build (xAI) logins: the desktop collector reads `~/.grok` (or
  `$GROK_HOME`) and the weekly usage pool from Grok Build's billing view, Add
  subscription signs a new account in with `grok login --device-auth`, the shell
  snippet switches `grok` between accounts, and the X Subscription tiers (plus
  SuperGrok and SuperGrok Heavy) are in the plan catalog.
- 4ea785b: Add server-evaluated feature flags, wired into the API, web and mobile.

  Flags are declared in code, targeted in the database, evaluated on the server
  and read on every client from one endpoint — the shape Stripe and Revolut
  describe for their own.

  - **`@flama/shared`** gains `feature-flags/`: the `FEATURE_FLAGS` catalog
    (every flag the code may read, with its kind, owner, safe default and — for
    temporary flags — expiry), the pure evaluator (ordered rules, segments,
    semver targeting on the app build, deterministic MurmurHash3 percentage
    splits bucketed by organization), and the Zod schemas for targeting writes.
    `@flama/shared/feature-flags/catalog` is a Zod-free subpath for the web
    bundle. A `flags` scope group and a `FeatureFlag` subject join the catalogs.
  - **`@flama/api`** gains a `feature-flags` module. Every replica holds all
    targeting in memory and evaluates without I/O, polling a cheap fingerprint
    to stay in sync and keeping its last good snapshot through a database blip.
    `GET /v1/feature-flags` serves the caller's evaluated client flags (signed
    out too); the control-plane endpoints under `/v1/feature-flags/admin`,
    `/segments` and `/changes` edit targeting, pull kill switches, manage
    segments, explain an evaluation and read the audit trail, which every change
    lands on through the outbox. `@RequireFlag('key')` gates a route on a flag,
    and token creation is now behind the `api_token_creation` kill switch. New
    error codes `FLAG_001`–`FLAG_007`. Migration `AddFeatureFlags`.
  - **`@flama/frontend-core`**: a `feature-flags` kernel module and
    `useFeatureFlag` / `useFeatureFlagValue` / `useFeatureFlags`, typed by the
    catalog, reading the API rather than PostHog. Flags are prefetched as soon as
    the session is known, persisted with the query cache, and an `experiment`
    flag records a `feature_flag_exposed` event. `FlamaApp.create` takes
    `featureFlags: { platform, appVersion }`.

    **Breaking:** feature flags leave the analytics port. `IAnalyticsClient` no
    longer has `getFeatureFlags` / `onFeatureFlags`, `AnalyticsService` no longer
    serves flags, `analyticsKeys.flags` is gone, and `isFlagEnabled` moved to the
    `feature-flags` module. `useFeatureFlag(key)` keeps its name but now takes a
    catalog key and reads the server's answer.

  - **`@flama/frontend-web` / `@flama/frontend-mobile`**: the PostHog adapters
    drop their flag methods and switch PostHog's own flag loading off. The mobile
    query client now follows `AppState`, so `refetchOnWindowFocus` works on a
    phone and a pulled kill switch lands when the app returns to the foreground.
    The unused `featureFlags` section of the mobile remote config is removed:
    remote config is for tunables, not flags.
  - **`@flama/web` / `@flama/mobile`** report their platform and build, and the
    web API-tokens screen reads `api_token_creation`.

  `pnpm check:flags` (in CI) fails on a temporary flag past its expiry date and
  on a flag the catalog declares but no code reads.

- 0650ecf: In the desktop app, the bottom of Settings shows which version of ResetOwl
  is running (`ResetOwl 0.1.0`), read from the desktop bridge. A browser shows
  nothing there.
- e33f950: Subtrack's first version: the `accounts` API (sync, list, edit, activate, archive, usage by model and day), the Claude Code and Codex readers in `@flama/usage-providers`, the Overview, Accounts, Tokenmaxx and Usage screens on the ported dashboard design system, and the Electron desktop app that collects local logins and syncs them.
- 4ea785b: Two-factor authentication: Better Auth's `twoFactor` plugin (an authenticator app plus single-use backup codes), optional per user. The `AddTwoFactor` migration adds `user."twoFactorEnabled"` and the `twoFactor` table, and the profile reports the enrolment and whether the account has a password sign-in (`hasPassword`, computed from Better Auth's `account` table); an account made through a social provider is not offered two-factor, which only guards password sign-in. A password sign-in on an account with it on rejects with `TwoFactorRequiredError`, which the web and mobile login screens answer with a code step (`TwoFactorChallengeForm` in each kit, `useVerifyTwoFactor`). The web profile sets it up behind the switch that was read-only, with a QR code, and turns it off or replaces the backup codes. `IAuthClient` gains `verifyTwoFactor`, `enableTwoFactor`, `confirmTwoFactor`, `disableTwoFactor` and `generateBackupCodes`, so every app's client implements them. `TWO_FACTOR_ISSUER` names the account in authenticator apps.
- 4ea785b: Make the web delivery path carry its weight: compression, caching, a real CSP,
  and a budget that keeps first load honest.

  The built SPAs were served by a 14-line nginx config that set none of the three
  things nginx does not do by default. The official image ships `gzip` commented
  out, so the ~1.1MB entry chunk went over the wire uncompressed; hashed assets
  got no `Cache-Control`, so every repeat visit revalidated all ~50 chunks; and
  the Content-Security-Policy that `index.html` and `public/theme-init.js` were
  already written against — both keep the theme bootstrap in a separate file
  specifically to avoid an inline-script exception — did not exist. All three are
  now set, with the policy's third-party origins in one substituted
  `CSP_EXTRA_ORIGINS` variable (defaulted in the Dockerfile, overridable per
  deployment). Measured on the current build:
  1,130KB → 324KB for the entry chunk, 152KB → 24KB for the stylesheet.

  On the critical path itself:

  - **Only the default locale is bundled.** `@flama/translations` grew two
    narrower entrypoints — `/locales` for metadata and `/lazy` for one catalog per
    chunk — because importing `locales` or `Messages` from the root barrel put
    every catalog in the entry chunk. The Spanish catalog was measurably inside
    what an English reader downloaded before anything rendered.
  - **The session lookup starts before the bundle parses.** Nothing renders until
    `useSessionRestore` resolves, and that request used to begin only after the
    bundle had downloaded, parsed and mounted React. `public/session-preload.js`
    issues it from `<head>`; `consumeSessionPreload` in `@flama/auth` takes the
    answer once, and falls back to the auth client for anything unusable, so the
    worst case is a wasted request rather than a reader treated as signed out.
  - **Route chunks are prefetched on intent.** `defaultPreload: 'intent'` means
    hovering a link fetches the route it points at, instead of every navigation
    starting a request.
  - **Dependencies are chunked per library** via a shared
    `@flama/tsconfig/vite-chunks.mjs`, so a release invalidates app code (42KB) and
    leaves the vendor chunks cached (263KB). Splitting costs ~48KB gzipped on a
    cold first load, which is the trade the `immutable` caching above pays for —
    the number is recorded in that file.
  - `sideEffects` declared on `@flama/design-system-web` (CSS excepted),
    `@flama/translations` and `@flama/api-client`, worth ~7KB gzipped.

  And so it stays fixed: `pnpm check:bundle` gzips everything the built
  `index.html` references and fails past a committed budget, in CI after
  `pnpm build`. Vite's own 500KB warning prints and passes, which is how a 1.1MB
  entry chunk went unnoticed. The Playwright `api` project runs in CI too — 69
  specs that existed and that no job ran, five of which had been failing since the
  console mailbox line gained a `Locale:` segment the e2e helper never learned
  about. The `web` project stays out until it is repaired: it drives a `/team`
  route `apps/web` no longer has, and 15 of its 64 specs fail on `main`. See
  `e2e/README.md`.

- deed06d: Track a Z.AI Coding Plan by hand. `zai` joins the providers as the first manual one: its Lite, Pro and Max plans (credits per window from Z.AI's docs; only Lite's $18 price is published, so Pro and Max take the price paid), `POST /v1/accounts` to add one and `POST /v1/accounts/:id/usage` to record its 5-hour and weekly usage. The desktop collector, sync and terminal switching stay Claude Code and Codex only. A `Select` inside a dialog now opens above it.

### Patch Changes

- 4ea785b: Put everything before the console under one `_auth` layout, and let each route
  say for itself who may reach it.

  `_auth` used to be chrome _and_ a gate: it mounted `AuthLayout` and called
  `redirectSignedIn`, so every route beneath it had to be a signed-out route.
  Two things did not fit. `accept-invitation` is reachable by a signed-out
  invitee _and_ a signed-in one, which the guard handled with an exception —
  `allow: ['/accept-invitation']`. And `/onboarding`, which only a signed-in
  account should see, could not live under that layout at all, so it sat outside
  with its own copy of the layout's chrome.

  Now `_auth` renders and guards nothing, and its three children each answer for
  themselves: `_auth/_public.tsx` turns signed-in visitors away,
  `_auth/onboarding.tsx` turns signed-out ones away, and
  `_auth/accept-invitation.tsx` carries no guard because both are legitimate
  there.

  **`redirectSignedIn` drops its `allow` parameter.** An exception list beside a
  guard is a second copy of the tree and can drift from the paths it names; a
  route both readers may open belongs under a parent that guards nobody, which
  cannot. Nothing passed `allow` any more, and leaving it exported is how the
  next route that "does not fit" gets appended to it instead of placed.

  **`redirectSignedOut` joins it**, so the pair is symmetric. Three routes had
  each written the signed-out bounce inline — both apps' `_authenticated` and
  the onboarding step — and with it the `/login` target and the reason it sends
  `location.href` rather than `location.pathname`. Now a route picks one guard,
  the other, or neither.

  The onboarding screen had hand-rolled the auth column: the same padding, the
  same theme toggle in the same corner, the same 400px measure. It renders in
  the real layout now and its wrapper is a fragment.

  Every URL is unchanged — `/login`, `/register`, `/forgot-password`,
  `/reset-password`, `/accept-invitation` and `/onboarding` all resolve exactly
  as before.

- 4ea785b: Stripe billing leaves the starter for the `billing` plugin, and the `leads`
  example is removed.

  - `@flama/api` no longer ships `BillingModule`, its migrations, the `stripe`
    config or the `stripe` dependency, and no longer ships `LeadsModule`.
    `pnpm plugin:add billing` puts billing back, then
    `pnpm generate:api-client`.
  - `@flama/shared` drops the `billing` and `leads` scope resources and
    permission groups, the `stripe_billing` capability, the `Billing` subject,
    the `/billing/subscriptions` endpoint policy and the billing and lead schemas.
  - `@flama/api-client` drops the billing and leads endpoints and models. Its
    legacy models now take `Scope`, `ScopeResource` and `ClientCapabilities` from
    `@flama/shared` instead of spelling them out. `openapi-ts` reads
    `apps/api/openapi.json` from the right path again, so `src/generated` is
    regenerated.
  - `@flama/translations` drops the `BILLING_*` and `LEAD_*` error copy; the
    plugin carries the billing copy.
  - `@flama/web`'s permission picker gives a resource without an icon of its own
    a generic key icon, so a plugin's scope group renders without an edit here.

- 4ea785b: Extract the Better Auth configuration both sides must agree on into a new `@flama/auth` package: the user-fields schema (consumed by the server's `user.additionalFields` and the clients' `inferAdditionalFields`), the shared client plugin set (`admin`, `organization` with the `teams` flag), and the `unwrap()` / `toAuthSession()` helpers previously copy-pasted into both client adapters. The `./client` entry ships TypeScript sources to preserve Better Auth's type inference; the root entry is compiled CJS for the NestJS API.
- ef50b9e: A Grok Build account now shows on Renewals. xAI's billing views name no tier for a unified X Subscription account, so its plan and price are unknown; Renewals' "no renewal day" list now also takes an account whose plan or price is unknown, so it asks for its day instead of vanishing. The Grok reader's tests carry the billing responses xAI answers today.
- 56418e8: Serve the screens and the site from nginx 1.31.9, pinned by digest: the first release with the fix for CVE-2026-123007 and the rest of the November 2026 HTTP/2 advisories.
- 4ea785b: The permission picker no longer draws an icon per group. It kept a closed map
  from resource to icon beside the scope catalog, and every group the map did not
  know — a plugin's — was drawn with the API-token key.
- 4ea785b: A signed-in device's "last seen" on the profile's Sessions pane moves on by itself: the session list reads the time from one `useNow` a minute and hands it to every row, instead of each row reading `new Date()` in render, which the React Compiler cached until something unrelated changed.
- 4ea785b: One `.env` at the repo root, documented by a root `.env.example`.

  New `@flama/env` package locates the workspace root (walking up to
  `pnpm-workspace.yaml` or a `package.json` with `workspaces`), loads `.env`
  then `.env.local` (local wins between the files), and never overwrites a
  value already in `process.env` — real environment variables always win, so
  the same loader is correct in CI and in production containers.

  - `apps/api` entry points (`main.ts`, TypeORM CLI `data-source.ts`, seed,
    OpenAPI generation, `auth.ts`) import `@flama/env/load` instead of
    `dotenv/config`, which resolved `.env` against `process.cwd()`. The TypeORM
    CLI previously loaded no env file at all.
  - `apps/web` reads the root file via Vite's `envDir`; a `.env` inside the app
    directory is no longer read.
  - `apps/mobile` loads the root file in `app.config.ts` before Metro bundles,
    and its deep-link `scheme` now reads `MOBILE_SCHEME` — the same variable the
    API uses for its trusted origin — instead of a hardcoded copy.
  - Stale variables removed: the `JWT_SECRET` fallback for `BETTER_AUTH_SECRET`
    and `JWT_REFRESH_SECRET` / `NEXT_PUBLIC_API_URL` in
    `docker/docker-compose.prod.yml` (which now passes `BETTER_AUTH_SECRET` /
    `BETTER_AUTH_URL`); `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` were documented
    but never read and are not carried over.

  The three per-app `.env.example` files are replaced by a single root
  `.env.example` documenting every variable the repo reads.

- 4ea785b: Web: a tab opened before a deploy reloads when a lazily loaded chunk the deploy removed fails to load, instead of failing into the nearest error boundary.
- 4ea785b: Name the config package after what it holds, and put the endpoint policies next
  to CASL.

  `@flama/config` is now `@flama/tsconfig`, in `packages/tsconfig/`. "Config" said
  nothing — the repo has seven other things that answer to it (`src/config/` in
  the API, `ShellConfig`, `vite.config.ts`, the root `.env`) — while the package
  holds tsconfig presets and the two build-time helpers that travel with them
  (`vite-chunks.mjs`, `depcruise/*.cjs`). Every `extends`, devDependency,
  Dockerfile `COPY` and doc reference moved with it; nothing else changed.

  `@flama/shared` no longer exports `./navigation`. `SCREENS` paired a web route
  (`/team`, `/api-tokens`) with the endpoint behind it and the rules that endpoint
  demands. The endpoint half is a real contract and stays, as `ENDPOINT_POLICIES`
  in `@flama/shared/permissions` — keyed by the path Nest mounts the handler at,
  which is what `apps/api/src/auth/__tests__/endpoint-policies.spec.ts` (renamed
  from `screen-policies.spec.ts`) pins the controllers to.

  The route half is deleted rather than rehoused. Those five paths are not routes
  any app mounts: `apps/web` serves `/dashboard`, `/settings` and
  `/settings/api-tokens`, `apps/admin-web` serves `/users` and `/roles`, and
  neither read the catalog — both nav files write their rows out by hand. A list
  of one product's leftover URLs does not earn a home in the platform kit both
  Vite apps compile. The rule that survives is smaller and is now what the docs
  say: a gated nav row takes `policies: ENDPOINT_POLICIES['/tokens']` where the
  row is declared, never a literal rule list, and the route string stays in the
  app that mounts it.

  The catalog also carries its own invariants now. `ENDPOINT_POLICIES` is typed
  `Record<string, readonly [EndpointPolicy, ...EndpointPolicy[]]>`, so an empty
  rule list and a misspelled member are both compile errors — which is what the
  package-local spec was asserting at runtime, so it is gone. `HANDLERS` in the
  API test is a `Record<GuardedEndpoint, …>`, so a new catalog entry fails to
  compile until a handler is named for it. Nothing casts.

  `permissions/index.ts` became a barrel over `abilities.ts` (a verbatim move of
  the old file) and `endpoint-policies.ts`.

- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [69128f7]
- Updated dependencies [0fbe635]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [47d4885]
- Updated dependencies [67d26cb]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [ef55a1e]
- Updated dependencies [5028983]
- Updated dependencies [617839c]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [773192b]
- Updated dependencies [e0c087f]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [7455960]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [e33f950]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [deed06d]
  - @flama/api-client@1.0.0
  - @flama/shared@1.0.0
  - @flama/translations@1.0.0
  - @flama/design-system-web@0.2.0
  - @flama/frontend-core@1.0.0
  - @flama/frontend-web@1.0.0
  - @flama/frontend-consumer@1.0.0
  - @flama/auth@0.2.0
  - @flama/react-hooks@0.2.0

## 0.2.0

### Minor Changes

- e209380: Add a CLI and an MCP server, both governed by granular per-credential
  permissions.

  Authorization gains a second layer. Roles say what a _person_ may do; **scopes**
  say what a _credential_ may do on their behalf, and the two are intersected on
  every request. A token can never be minted with more reach than its creator
  has, and revoking someone's role immediately narrows every credential they
  issued.

  - **`@flama/shared`**: the scope catalog — nine permission groups
    (profile, users, admin, roles, organizations, members, invitations,
    workspaces, tokens), each with a Read and an Edit level backed by the CASL
    rules it authorizes. Helpers for parsing, the write ⇒ read implication, the
    OAuth string form, and `grantableScopes`/`ungrantableScopes`, which enforce
    the "never exceed your creator" rule. Plus `ResourceScope` for per-organization
    narrowing, Zod schemas for token creation, and an `ApiToken` subject with
    own-token permissions on the seeded `user` role.

  - **`@flama/api`**: a new `api-tokens` DDD module (Better Auth 1.6 no longer
    ships an apiKey plugin). Only a SHA-256 digest of each secret is stored;
    tokens support expiry, IP allowlists and organization scoping, and are revoked
    rather than deleted. `ApiAuthGuard` replaces Better Auth's cookie-only guard
    and accepts a session cookie, an API token or an OAuth access token;
    `ScopesGuard` is registered globally and fails closed, so a route that
    declares no `@RequireScopes` cannot be reached by a token at all. The MCP
    plugin adds OAuth 2.1 discovery, dynamic client registration and a consent
    page. New endpoints: `GET|POST /v1/tokens`, `DELETE /v1/tokens/:id`,
    `GET /v1/tokens/permissions` and `GET /v1/me/credential`.

  - **`@flama/mcp`** (new): an MCP server exposing 26 tools over stdio and
    Streamable HTTP from one registry. Tools declare the scopes they need and the
    tool list is filtered by the credential's effective scopes, so an agent is
    never shown a capability that would be refused.

  - **`@flama/cli`** (new): `flama` — login that trades a session for a scoped
    token, token management with a permission catalog, users/roles/orgs/workspaces
    commands, `--json` output, profiles, and `flama mcp install` to connect an
    agent.

  - **`@flama/web`** / **`@flama/frontend`** / **`@flama/translations`**: a
    token-creation screen with a per-resource permission picker (levels you cannot
    grant are disabled) and an OAuth consent screen, backed by new `api-tokens`
    and `organizations` modules with TanStack Query hooks.

  Deploying runs a migration that adds the `api_token` and OAuth tables and grants
  every user permission over their own tokens. `pnpm generate:api-client` no
  longer needs a running database.

### Patch Changes

- Updated dependencies [4943eff]
- Updated dependencies [e209380]
- Updated dependencies [a93cf5d]
- Updated dependencies [55e1d1a]
- Updated dependencies [9c3e158]
- Updated dependencies [68348a6]
- Updated dependencies [719859f]
  - @flama/shared@0.2.0
  - @flama/frontend@0.2.0
  - @flama/api-client@0.2.0
  - @flama/translations@0.2.0

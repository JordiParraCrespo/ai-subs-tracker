# @flama/usage-providers

## 0.3.0

### Minor Changes

- dcc9b27: A lapsed Grok Build session is renewed by Grok Build itself instead of asking for a sign-in every day. The reader starts the CLI the way Orca runs Grok with no window: `grok --permission-mode default agent --no-leader stdio`, ACP `initialize` and `authenticate` with the saved `cached_token` login, and, only when that leaves `auth.json` lapsed, Orca's headless read-only prompt, a model request that makes the CLI renew its session. ResetOwl still never reads the refresh credential or writes the file. The CLI offering no saved login is the one sign-out; where `grok` cannot run, the stale and day-old rules stay as they were.

## 0.2.0

### Minor Changes

- 69128f7: Stop idle Claude Code accounts turning into "Sign in again" after a few hours. An account nobody runs Claude in still has a valid login — only its short-lived access token lapses — so ResetOwl now lets Claude Code's own CLI renew it instead of reporting it signed out.

  `packages/usage-providers` (pure, read-only) no longer decides expiry from the stored timestamp alone: a lapsed access token whose refresh token is still good reads as the new `auth_stale` status, and only a login that cannot be renewed (no refresh token, its expiry passed, or the vendor rejected it) is `auth_expired` → "Sign in again". The provider also describes a `refreshCommand` (`claude auth status`), built from its existing `launchEnv`/`loginCommand`.

  The desktop collector (`renew-login.ts`) runs that command for a login read as `auth_stale` — stdin closed, timed out, at most one per folder at a time, backed off after a failure — so Claude Code refreshes its own access token and rewrites its credential file, then reads the login again. The default `~/.claude` is run with no `CLAUDE_CONFIG_DIR`, so the macOS Keychain item is the one a terminal would use (that Keychain write is verified only in code review here, not on Linux). ResetOwl still never calls `oauth/token` and never writes a credential itself.

  While a login is renewable-but-stale (e.g. the CLI is not installed), the API keeps showing its last good reading instead of empty bars: `GET /v1/accounts` carries forward the windows from the most recent snapshot that had them, dropping any whose reset has passed, and the screens mark the account `Stale` rather than "Sign in again".

  Follow-up to the Codex reported-billing-day and GLM unofficial-reader work; Codex is left unchanged pending verification that a Codex command renews its own token without spending usage (issue #9's open question).

- 0fbe635: Put Codex plans on the Renewals calendar without asking. The Codex reader takes the end of the paid period from the `id_token` in `auth.json` (`chatgpt_subscription_active_until`, an undocumented claim, read locally with no new request) and syncs only its day of the month, in the machine's local time, with when ChatGPT last checked the subscription (`reportedRenewal` on `POST /v1/accounts/sync`, optional so older collectors still sync). The token is reissued only when Codex refreshes its login, so the date itself can be a period or more behind; the day a plan bills does not move. The API keeps it beside the person's own day (`reportedRenewalDay`, `renewalCheckedAt`): `renewalDay` is the person's, else the reported one, and `renewalDayOverridden` says which. The edit form leaves the field empty for a reported day and shows it as the placeholder, so clearing an override falls back to the login, and Next 30 days says where a reported day came from. Claude Code reports no billing day and keeps "Set day".
- ef55a1e: Read a GLM Coding Plan's usage automatically, opt-in, and track BigModel plans. `bigmodel` joins `zai` as a manual provider, with its Lite, Pro and Max plans (no published price: the account carries the one paid, in US dollars). In the desktop app, a Z.AI or BigModel account can turn on an unofficial usage reader: the person's Coding Plan key, encrypted with `safeStorage`, reads `/api/monitor/usage/quota/limit` on the vendor's own site (undocumented; the endpoint the vendor's usage plugin calls) and the desktop sends the 5-hour, weekly and monthly MCP windows to the new `POST /v1/accounts/:id/readings`, never the key. Readings carry the source `unofficial`, the screens say so, and they lapse like hand-typed ones; recording by hand stays the fallback.
- 5028983: Track Grok Build (xAI) logins: the desktop collector reads `~/.grok` (or
  `$GROK_HOME`) and the weekly usage pool from Grok Build's billing view, Add
  subscription signs a new account in with `grok login --device-auth`, the shell
  snippet switches `grok` between accounts, and the X Subscription tiers (plus
  SuperGrok and SuperGrok Heavy) are in the plan catalog.
- e33f950: Subtrack's first version: the `accounts` API (sync, list, edit, activate, archive, usage by model and day), the Claude Code and Codex readers in `@flama/usage-providers`, the Overview, Accounts, Tokenmaxx and Usage screens on the ported dashboard design system, and the Electron desktop app that collects local logins and syncs them.

### Patch Changes

- ef50b9e: A Grok Build account now shows on Renewals. xAI's billing views name no tier for a unified X Subscription account, so its plan and price are unknown; Renewals' "no renewal day" list now also takes an account whose plan or price is unknown, so it asks for its day instead of vanishing. The Grok reader's tests carry the billing responses xAI answers today.
- deed06d: Track a Z.AI Coding Plan by hand. `zai` joins the providers as the first manual one: its Lite, Pro and Max plans (credits per window from Z.AI's docs; only Lite's $18 price is published, so Pro and Max take the price paid), `POST /v1/accounts` to add one and `POST /v1/accounts/:id/usage` to record its 5-hour and weekly usage. The desktop collector, sync and terminal switching stay Claude Code and Codex only. A `Select` inside a dialog now opens above it.
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [69128f7]
- Updated dependencies [0fbe635]
- Updated dependencies [4ea785b]
- Updated dependencies [47d4885]
- Updated dependencies [67d26cb]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [ef55a1e]
- Updated dependencies [5028983]
- Updated dependencies [773192b]
- Updated dependencies [e0c087f]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [e33f950]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [deed06d]
  - @flama/shared@1.0.0

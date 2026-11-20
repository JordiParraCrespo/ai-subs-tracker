# @flama/desktop

## 0.2.0

### Minor Changes

- 69128f7: Stop idle Claude Code accounts turning into "Sign in again" after a few hours. An account nobody runs Claude in still has a valid login — only its short-lived access token lapses — so ResetOwl now lets Claude Code's own CLI renew it instead of reporting it signed out.

  `packages/usage-providers` (pure, read-only) no longer decides expiry from the stored timestamp alone: a lapsed access token whose refresh token is still good reads as the new `auth_stale` status, and only a login that cannot be renewed (no refresh token, its expiry passed, or the vendor rejected it) is `auth_expired` → "Sign in again". The provider also describes a `refreshCommand` (`claude auth status`), built from its existing `launchEnv`/`loginCommand`.

  The desktop collector (`renew-login.ts`) runs that command for a login read as `auth_stale` — stdin closed, timed out, at most one per folder at a time, backed off after a failure — so Claude Code refreshes its own access token and rewrites its credential file, then reads the login again. The default `~/.claude` is run with no `CLAUDE_CONFIG_DIR`, so the macOS Keychain item is the one a terminal would use (that Keychain write is verified only in code review here, not on Linux). ResetOwl still never calls `oauth/token` and never writes a credential itself.

  While a login is renewable-but-stale (e.g. the CLI is not installed), the API keeps showing its last good reading instead of empty bars: `GET /v1/accounts` carries forward the windows from the most recent snapshot that had them, dropping any whose reset has passed, and the screens mark the account `Stale` rather than "Sign in again".

  Follow-up to the Codex reported-billing-day and GLM unofficial-reader work; Codex is left unchanged pending verification that a Codex command renews its own token without spending usage (issue #9's open question).

- 6b4f040: Deploy to production. The macOS app is built for arm64 and x64, signed with a
  Developer ID under the hardened runtime, notarized and attached to a GitHub
  release on a `desktop-v*` tag. The landing page is published to Cloudflare
  Pages with the same headers its nginx image sets. The API and web app run on
  a Docker server that opens no port: public traffic arrives through a
  Cloudflare Tunnel, administration over Tailscale (docker/README.md).

  The site has a download page (`/download/`, in English and Spanish): a card
  per platform linking to the newest release's installer, the reader's own
  platform marked, and what to do after downloading. Every "Download" link on
  the site goes there. The desktop release now builds Windows and Linux too,
  under file names without the version, so those links hold across releases.

- 47d4885: The desktop app updates itself. It looks for a new release shortly after it
  starts and every six hours, downloads it in the background and installs it
  when the app quits. A card in the bottom corner offers "Restart now" once a
  version is ready, reports a download that failed, and after an update says
  which version it replaced. Settings › Updates shows the version and the last
  check, checks on demand, and turns installing on quit off. The tray offers
  "Restart to update". Builds that cannot replace themselves (a development
  run, a Linux install other than the AppImage) point to the download page.
- 67d26cb: The desktop app speaks the person's language. The screens start from the
  operating system's preferred languages (the bridge's new `systemLocales`)
  when nothing was picked on the device, and report what they show through
  `setLocale`, so the tray menu, tooltip and headline read the same. Tray copy
  lives in the new `desktop` translation area (English and Spanish).
- ef55a1e: Read a GLM Coding Plan's usage automatically, opt-in, and track BigModel plans. `bigmodel` joins `zai` as a manual provider, with its Lite, Pro and Max plans (no published price: the account carries the one paid, in US dollars). In the desktop app, a Z.AI or BigModel account can turn on an unofficial usage reader: the person's Coding Plan key, encrypted with `safeStorage`, reads `/api/monitor/usage/quota/limit` on the vendor's own site (undocumented; the endpoint the vendor's usage plugin calls) and the desktop sends the 5-hour, weekly and monthly MCP windows to the new `POST /v1/accounts/:id/readings`, never the key. Readings carry the source `unofficial`, the screens say so, and they lapse like hand-typed ones; recording by hand stays the fallback.
- 5028983: Track Grok Build (xAI) logins: the desktop collector reads `~/.grok` (or
  `$GROK_HOME`) and the weekly usage pool from Grok Build's billing view, Add
  subscription signs a new account in with `grok login --device-auth`, the shell
  snippet switches `grok` between accounts, and the X Subscription tiers (plus
  SuperGrok and SuperGrok Heavy) are in the plan catalog.
- e33f950: Subtrack's first version: the `accounts` API (sync, list, edit, activate, archive, usage by model and day), the Claude Code and Codex readers in `@flama/usage-providers`, the Overview, Accounts, Tokenmaxx and Usage screens on the ported dashboard design system, and the Electron desktop app that collects local logins and syncs them.

### Patch Changes

- deed06d: Track a Z.AI Coding Plan by hand. `zai` joins the providers as the first manual one: its Lite, Pro and Max plans (credits per window from Z.AI's docs; only Lite's $18 price is published, so Pro and Max take the price paid), `POST /v1/accounts` to add one and `POST /v1/accounts/:id/usage` to record its 5-hour and weekly usage. The desktop collector, sync and terminal switching stay Claude Code and Codex only. A `Select` inside a dialog now opens above it.

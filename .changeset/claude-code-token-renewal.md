---
"@flama/api": minor
"@flama/api-client": minor
"@flama/shared": minor
"@flama/web": minor
"@flama/usage-providers": minor
"@flama/desktop": minor
"@flama/translations": minor
---

Stop idle Claude Code accounts turning into "Sign in again" after a few hours. An account nobody runs Claude in still has a valid login — only its short-lived access token lapses — so ResetOwl now lets Claude Code's own CLI renew it instead of reporting it signed out.

`packages/usage-providers` (pure, read-only) no longer decides expiry from the stored timestamp alone: a lapsed access token whose refresh token is still good reads as the new `auth_stale` status, and only a login that cannot be renewed (no refresh token, its expiry passed, or the vendor rejected it) is `auth_expired` → "Sign in again". The provider also describes a `refreshCommand` (`claude auth status`), built from its existing `launchEnv`/`loginCommand`.

The desktop collector (`renew-login.ts`) runs that command for a login read as `auth_stale` — stdin closed, timed out, at most one per folder at a time, backed off after a failure — so Claude Code refreshes its own access token and rewrites its credential file, then reads the login again. The default `~/.claude` is run with no `CLAUDE_CONFIG_DIR`, so the macOS Keychain item is the one a terminal would use (that Keychain write is verified only in code review here, not on Linux). ResetOwl still never calls `oauth/token` and never writes a credential itself.

While a login is renewable-but-stale (e.g. the CLI is not installed), the API keeps showing its last good reading instead of empty bars: `GET /v1/accounts` carries forward the windows from the most recent snapshot that had them, dropping any whose reset has passed, and the screens mark the account `Stale` rather than "Sign in again".

Follow-up to the Codex reported-billing-day and GLM unofficial-reader work; Codex is left unchanged pending verification that a Codex command renews its own token without spending usage (issue #9's open question).

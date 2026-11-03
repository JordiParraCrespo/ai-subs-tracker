# @flama/usage-providers

Reads the coding-agent logins on this machine — Claude Code config dirs and
Codex homes — and turns each into a `SyncAccount`, the wire contract in
`@flama/shared/schemas/accounts`: identity, plan, limit windows and tokens per
local day. Pure Node (no Electron); the Subtrack desktop app calls it and
sends the result to the API. It never sends a credential anywhere but the
provider that issued it.

## Usage

```ts
import { collectAll, nodeProviderEnv } from '@flama/usage-providers';

const env = nodeProviderEnv({
  managedRoot: '/path/to/app-data/homes',
  userAgent: 'subtrack-desktop/0.1.0',
});
const accounts = await collectAll(env, { sinceDay: '2026-10-01', fetchLimits: true });
// [{ login: DetectedLogin, account: SyncAccount }, …]
```

## Exports

| Export | What it is |
| --- | --- |
| `PROVIDERS`, `getProvider`, `defineProviders` | The providers, Claude Code first, then Codex; ids are unique |
| `claudeCodeProvider`, `codexProvider` | The two `CodingAgentProvider`s |
| `collectAll(env, opts)` | Detect + read every login; one row per provider + `externalId`, the default login kept |
| `nodeProviderEnv(opts)`, `readMacKeychain` | A real `ProviderEnv`; the Keychain via `/usr/bin/security` on macOS, null elsewhere |
| `parseClaudeStatusline(json)` | `rate_limits` from Claude Code's statusline JSON → `LimitWindow[]`, or null |
| `parseClaudeUsage`, `parseCodexUsage`, `parseCodexAuth`, `parseSessionRateLimits`, `parseClaudeLogLine`, `decodeJwtPayload`, `keychainServiceFor`, `claudeReportedPlan`, `defaultCodexHome`, `externalIdFor`, `localDay` | The parsers and rules underneath, for the live feed and for tests |
| Types | `ProviderEnv`, `DetectedLogin`, `LoginCommand`, `ReadOptions`, `CodingAgentProvider`, `CollectedAccount` |

A provider has `detect(env)`, `read(login, env, opts)` (never throws: a
failure is the snapshot's `status` and `message`), `loginCommand(home)` (spawn
it to sign a new account into an isolated home) and `launchEnv(login)` (`{}`
for the default login).

## What it reads

**Claude Code** — `~/.claude`, `$CLAUDE_CONFIG_DIR`, `~/.claude-*` dirs that
hold a marker (`.credentials.json`, `.claude.json`, `projects/`,
`settings.json`), and `<managedRoot>/claude-code/*`.

- Login: `<dir>/.credentials.json` `claudeAiOauth`, or on macOS the Keychain
  item `Claude Code-credentials` (`-<first 8 hex of sha256(dir)>` for any dir
  but `~/.claude`)
- Identity: `oauthAccount` in `<dir>/.claude.json` (`~/.claude.json` for the default)
- Limits: `GET https://api.anthropic.com/api/oauth/usage`
- Tokens: assistant `message.usage` in `<dir>/projects/**/*.jsonl`

**Codex** — `$CODEX_HOME` or `~/.codex`, and `<managedRoot>/codex/*`.

- Login and plan: `<home>/auth.json`, the `id_token` claims read without verification
- Limits: `GET https://chatgpt.com/backend-api/wham/usage`; when that fails
  (other than 401/403) the newest `rate_limits` a session logged
- Tokens: `token_count` events in `<home>/sessions/**/*.jsonl`

## Scripts

```bash
pnpm --filter @flama/usage-providers build
pnpm --filter @flama/usage-providers test
```

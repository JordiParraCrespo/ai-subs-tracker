# @flama/usage-providers — Agent Instructions

Reads coding-agent logins on the local machine into `SyncAccount`
(`@flama/shared/schemas/accounts`). Used by the ResetOwl desktop app. Pure
Node: no Electron, no React, nothing from `apps/*`.

> Read the root [`CLAUDE.md`](../../CLAUDE.md). The contract it produces and the
> plan catalog it resolves against live in `packages/shared`
> (`schemas/accounts.schema.ts`, `subscriptions/plans.ts`); change them there.

## Layout

```
src/
├── types.ts           # ProviderEnv, DetectedLogin, LoginCommand, ReadOptions, CodingAgentProvider
├── registry.ts        # PROVIDERS (claude-code, then codex); duplicate ids throw
├── collect.ts         # collectAll: detect + read + de-dupe by provider and externalId
├── env.ts             # nodeProviderEnv: the real machine
├── lib/util.ts        # fs/JSONL helpers, local days, externalId, snapshot builder, token buckets
├── claude-code/       # credentials, usage-api (+ statusline), local-logs, the provider
├── codex/             # auth (JWT claims), usage-api (wham), sessions (tokens + offline limits), the provider
└── __tests__/         # vitest; fake homes in os.tmpdir(), fake fetch and keychain
```

## Rules

- **Read-only.** Never write to a provider's home, never touch its config.
- **Never refresh a token.** Refresh tokens rotate; refreshing here would sign
  the person's own CLI out. An expired login is `auth_expired` with a message
  telling them to run `claude` / `codex` once.
- **Credentials go only to the provider that issued them**: the Claude token to
  `api.anthropic.com`, the Codex token to `chatgpt.com`. Never into a
  `SyncAccount`, a log line or an error message.
- **Honest User-Agent**: `env.userAgent` (e.g. `resetowl-desktop/0.1.0`). Never
  impersonate Claude Code or Codex, and send none of their client headers
  (`originator`, `OpenAI-Beta`, …).
- **`read` never throws** for a provider failure: map it to the snapshot
  status (`ok`, `auth_expired`, `no_credentials`, `rate_limited` on 429,
  `error`) with a short human message. `fetchLimits: false` makes no request
  and returns `snapshot: null` with identity and tokens.
- **externalId**: the provider's account id; else `email:<lowercased email>`;
  else `home:<first 16 hex of sha256(home)>`.
- **The default login's `launchEnv` is `{}`.** Setting `CLAUDE_CONFIG_DIR` even
  to `~/.claude` changes the Keychain item Claude Code uses on macOS.
- The endpoints and log formats are undocumented: parse tolerantly, keep
  unknown windows (kind `other`) rather than dropping them, and clamp to the
  schema's limits.
- Everything outside the process goes through `ProviderEnv`
  (`fetch`, `readKeychain`, `now`, `env`, `home`), so tests never touch the
  network or the real home. A new provider is a folder plus one line in
  `registry.ts`, with specs over a fake home.

Only providers in `LOCAL_PROVIDER_IDS` live here. Z.AI's Coding Plan is
tracked by hand (`MANUAL_PROVIDER_IDS`, `packages/shared/src/subscriptions/plans.ts`):
its key sits in whatever tool uses it and Z.AI documents no usage API, so
there is nothing for this package to read. Its official `glm-plan-usage`
Claude Code plugin calls `/api/monitor/usage/quota/limit` with the key, but
that endpoint is not in Z.AI's documentation; reading it would mean reading
the person's key from their Claude Code settings, so it is not done.

Rules this package follows: [`provider-integrations.md`](../../.agents/rules/provider-integrations.md)
(one capability, a provider per vendor, an honest client name) and
[`integrations.md`](../../.agents/rules/integrations.md) (respect the vendor's
rate limits).

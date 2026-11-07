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
├── zai/               # quota: the opt-in unofficial reader for Z.AI / BigModel Coding Plans (not a provider)
└── __tests__/         # vitest; fake homes in os.tmpdir(), fake fetch and keychain
```

## Rules

- **Read-only.** Never write to a provider's home, never touch its config.
- **Never refresh a token here.** This package is pure and read-only: it never
  calls `oauth/token`, and refresh tokens rotate, so doing so would sign the
  person's own CLI out. It only *reads* the stored login and decides whether a
  lapsed access token is renewable (a refresh token that has not itself
  expired): a renewable one is `auth_stale`, a signed-out one `auth_expired`.
  Renewing a renewable login is the desktop collector's job, and it does it by
  running the vendor's own CLI (`claude auth status`) — described here by
  `refreshCommand`, run there — so the vendor's CLI refreshes its own token.
- **Credentials go only to the provider that issued them**: the Claude token to
  `api.anthropic.com`, the Codex token to `chatgpt.com`. Never into a
  `SyncAccount`, a log line or an error message.
- **Honest User-Agent**: `env.userAgent` (e.g. `resetowl-desktop/0.1.0`). Never
  impersonate Claude Code or Codex, and send none of their client headers
  (`originator`, `OpenAI-Beta`, …).
- **`read` never throws** for a provider failure: map it to the snapshot
  status (`ok`, `auth_stale` when a lapsed token is renewable, `auth_expired`
  when it is not, `no_credentials`, `rate_limited` on 429, `error`) with a
  short human message. `fetchLimits: false` makes no request and returns
  `snapshot: null` with identity and tokens.
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

Only providers in `LOCAL_PROVIDER_IDS` are `CodingAgentProvider`s. The one
other thing here is `zai/quota.ts`, the **unofficial usage reader** for the
hand-tracked GLM Coding Plans (`UNOFFICIAL_USAGE_READERS` in
`packages/shared/src/subscriptions/plans.ts`: Z.AI at `api.z.ai`, BigModel at
`open.bigmodel.cn`). It calls `GET /api/monitor/usage/quota/limit`, which
neither vendor documents (Z.AI's own `glm-plan-usage` plugin, Orca and ZCode
call it), with a key the person pasted into the desktop app:

- the key goes only to the provider's origin, over HTTPS, as the raw
  `Authorization` value, with redirects refused, and is scrubbed from every
  message; it is never read from another tool's config or credential store;
- the answer is parsed as Orca reads it (unit codes 1 day, 3 hour, 5 minute,
  6 week; credit counts over a lagging percentage; the `TIME_LIMIT` monthly MCP
  window), tolerantly, and a 5-hour reset more than 5 hours away is dropped;
- `readZaiQuota` never throws, and its snapshot's source is `unofficial`.

Rules this package follows: [`provider-integrations.md`](../../.agents/rules/provider-integrations.md)
(one capability, a provider per vendor, an honest client name) and
[`integrations.md`](../../.agents/rules/integrations.md) (respect the vendor's
rate limits).

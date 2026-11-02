# Subtrack

Use up the AI coding plans you pay for.

Subtrack is a desktop app for people who run several personal **Claude Code**
and **Codex** subscriptions. It finds the logins on your computer, shows how
much of each plan's 5-hour and weekly allowance is left, and tells you which
account to use next so nothing you paid for expires unused ("tokenmaxxing").
It also prices your usage at API rates, so you can see what each plan is worth.

The screens follow the designs in [`designs/`](designs/).

| Screen | What it answers |
| --- | --- |
| **Overview** | What the plans cost a month, their value at API prices, how much allowance expired unused in the last month, what needs attention and which weeks reset next |
| **Subscriptions** | Every login with its session and weekly usage, plan and price, and which one your terminals use |
| **People** | The identities (emails) holding the plans, which plans sat idle this week, and what each costs |
| **Tokenmaxx** | The account to use next (the most headroom per hour before its reset), and the queue against an even pace through the week |
| **Usage & tokens** | Tokens by day, account and model, and what the same usage would cost on the API |
| **Renewals** | A month calendar of when each plan bills, and the next 30 days (the billing day is yours to set: providers do not report it) |
| **Settings** | The terminal integration and the opt-in live feed from Claude Code |

## How it works

```
 your computer                                          Subtrack API
┌───────────────────────────────────────────────┐     ┌──────────────────┐
│ apps/desktop (Electron)                       │     │ apps/api         │
│  main: collector ── @flama/usage-providers ───┼──┐  │ /v1/accounts/*   │
│        reads ~/.claude*, ~/.codex, Keychain   │  │  │ provider_account │
│        tray: "use next"                       │  └─▶│ usage_snapshot   │
│  renderer: apps/web build on app://subtrack   │────▶│ token_usage_daily│
└───────────────────────────────────────────────┘     └──────────────────┘
```

- **Plans and limits.** For each login the collector reads the plan and asks
  the provider for its limit windows: Claude Code's OAuth usage endpoint, and
  Codex's ChatGPT usage endpoint, falling back to the rate limits Codex writes
  in its session logs. It sends an honest `subtrack-desktop/<version>` client
  name. Every 10 minutes, with back-off, and a 15-minute pause after a 429.
- **Tokens.** Counted from the CLIs' own transcripts (`~/.claude/projects`,
  `~/.codex/sessions`), per model and day, and priced with
  `packages/shared/src/subscriptions/model-prices.ts`.
- **Plans** are data in `packages/shared/src/subscriptions/plans.ts`, with the
  names providers used before (Max 20x is now **Ultra**). You can override an
  account's plan and price in the app.
- **Switching is a toggle.** Marking an account "in use" writes
  `~/.subtrack/active/<provider>`. The opt-in shell snippet makes `claude` and
  `codex` in your terminal follow it. **Add account** signs a new login into its
  own folder with the provider's CLI (`claude auth login`, `codex login`).

**What it never does:** refresh a provider's token, send a provider credential
anywhere but that provider, or replace a status line you already have. Only
identity, limit percentages, reset times and token counts reach the API.

## Repository

Built on the [Flama](https://github.com/JordiParraCrespo/flama-ai) boilerplate
(Turborepo + pnpm). The conventions are in [`AGENTS.md`](AGENTS.md).

| Path | What it is |
| --- | --- |
| `apps/desktop` | Electron shell: hosts the web build, collector, tray, token store, shell integration, live feed |
| `apps/web` | The screens (Vite + TanStack Router). One build serves the desktop app and, later, the web |
| `apps/api` | NestJS API (Domain-Driven Hexagon): auth, and the `accounts` module |
| `packages/usage-providers` | One `CodingAgentProvider` interface; Claude Code and Codex readers |
| `packages/shared` | Wire contracts (`schemas/accounts`), plan catalog, model prices, Tokenmaxx ranking, desktop bridge types |
| `packages/frontend/*` | Kernel, the consumer product package (accounts, profile), web kit, design system |
| `packages/backend/*` | The API's toolkit |
| `e2e` | Playwright suites for the API and the screens |
| `designs` | The Claude Design export the screens are built from |

Adding a provider (Grok, Z.ai and others) means a folder in
`packages/usage-providers`, its id in `PROVIDER_IDS`, and its plans in
`plans.ts`.

## Quick start

```bash
pnpm install
cp .env.example .env            # one .env at the repo root
pnpm docker:dev                 # Postgres + Redis
pnpm --filter @flama/api migration:run
pnpm exec turbo run dev --filter=@flama/api --filter=@flama/web
pnpm desktop:dev                # Electron over the web dev server
```

To run the desktop app on the bundled screens, or to package it:

```bash
pnpm --filter @flama/web build
pnpm --filter @flama/desktop build
pnpm --filter @flama/desktop start      # app://subtrack over the built screens
pnpm --filter @flama/desktop package    # dmg/zip, nsis, AppImage in apps/desktop/release
```

| Service | URL |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| API docs (Swagger) | http://localhost:3001/api/docs |

## Scripts

```bash
pnpm build                # Build everything
pnpm test                 # Unit tests
pnpm test:e2e             # Playwright suites (API and web running)
pnpm arch                 # Architecture boundaries
pnpm check:structure      # Frontend layout contract
pnpm ci:local             # Pull request CI's checks over what this branch changes
pnpm generate:api-client  # Regenerate the typed client after an API change
pnpm starter:check        # Feature markers (the Flama starter's pruning stays available)
```

## License

MIT

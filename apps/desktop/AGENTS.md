# @flama/desktop — Agent Instructions

> Read the root [`AGENTS.md`](../../AGENTS.md) first, and this app's
> [`README.md`](./README.md) for the module map, the bridge and the commands.

## Shape

- Electron **main + preload only**. The screens are the web app's build; no
  React, no UI code here. A screen that needs something local asks for it
  through the bridge.
- The contract is `@flama/shared/desktop` (`DesktopBridge`,
  `DESKTOP_CHANNELS`). Changing it is a change to `packages/shared` and to the
  screens in the same diff; a new channel needs a handler in `ipc.ts`, a parser
  in `ipc-validation.ts`, the preload method, and a test.
- Bundled by `scripts/build.mjs` (esbuild, CJS, `electron` external, workspace
  packages from their `flama-source` export). Everything is a devDependency:
  the packaged app ships `dist/` and nothing from `node_modules`.
- One module per job in `src/main/`; anything with a side effect (fs, clock,
  fetch, spawn, timers, `safeStorage`) is injected or isolated so the rule is
  tested in `src/main/__tests__/*.spec.ts`. Only `index.ts`, `window.ts` and
  `tray.ts` import `electron` in main.

## Rules that are not negotiable

- **Never send a provider credential** anywhere but the provider that issued
  it, and never refresh one. The sync carries identity, plan, windows and
  token counts.
- **Honest user agent**: `subtrack-desktop/<version> (<platform>)`. Never
  impersonate claude-code or codex.
- **Never log the API token.** It lives in `token-store.ts`, encrypted with
  `safeStorage`, memory-only when that is unavailable.
- **The default login's pointer is an empty file.** Writing `~/.claude` there
  would set `CLAUDE_CONFIG_DIR` and change the macOS Keychain item.
- **Opt-in and reversible**: the rc file is touched only by `shell.install()`
  and only between the markers; `settings.json` only when it has no
  `statusLine`, and the line is removed only when it is ours. Never replace
  someone else's configuration.
- The window: `contextIsolation`, `sandbox`, no `nodeIntegration`, no
  `window.open`, no navigation off the renderer origin (http(s) opens in the
  browser). IPC answers only the app's window on the renderer origin.
- Every IPC argument is parsed before use; a folder from the renderer must be
  one the collector found before anything is written into it.

## Before handing back

```bash
pnpm --filter @flama/desktop typecheck
pnpm --filter @flama/desktop test
pnpm --filter @flama/desktop build
pnpm exec biome check apps/desktop
# flama:begin web
pnpm --filter @flama/web build && xvfb-run -a pnpm --filter @flama/desktop exec electron . --no-sandbox --smoke
# flama:end web
```

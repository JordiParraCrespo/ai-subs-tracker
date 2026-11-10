# @flama/desktop — ResetOwl

The ResetOwl desktop app: an Electron shell for people with several personal
Claude Code and Codex subscriptions who want to use up what they pay for. It
reads the logins on this machine, sends their limits and token counts to the
ResetOwl API, keeps a tray entry saying which account to use next, and lets a
terminal follow the account marked active.

## Architecture

```
┌──────────── main process (src/main) ────────────┐      ┌──── renderer ────┐
│ collector ── usage-providers ── local logins    │      │ the web app's    │
│     │  └── POST /api/v1/accounts/sync (bearer)  │ IPC  │ build, served on │
│ pointers / shell integration / live feed / tray │◄────►│ app://resetowl/  │
│ token store (safeStorage)                       │      │ window.resetowl  │
└─────────────────────────────────────────────────┘      └──────────────────┘
                        ▲ preload (src/preload): contextBridge, ipcRenderer.invoke only
```

- **Main** (`src/main/`) — one small module per job, each tested without
  Electron where it can be (fs, clock, fetch, spawn and timers are injected):

  | Module | Job |
  | --- | --- |
  | `config.ts` | API URL, renderer URL, ResetOwl's user agent, run mode, CSP |
  | `window.ts`, `renderer-files.ts` | the `app://resetowl/` scheme (SPA fallback, CSP on HTML), the window and its navigation guards |
  | `token-store.ts` | the API session token, `safeStorage`-encrypted in `userData/session.bin` |
  | `local-logins.ts` | reads every login (`@flama/usage-providers`), builds `SyncAccountsInput` |
  | `api-client.ts` | `POST /api/v1/accounts/sync`, and `POST /api/v1/accounts/:id/readings` for the usage readers |
  | `usage-readers.ts` | the opt-in unofficial usage readers (Z.AI, BigModel): each pasted Coding Plan key `safeStorage`-encrypted in `userData/usage-readers.json`, read at most every 5 min after a sync, sent only to its vendor |
  | `collector.ts` | the loop: every 10 min, refresh (≤1/min), backoff, 401, rate-limit pause, live sends, then the usage readers |
  | `pointers.ts` | `~/.resetowl/active/<provider>`, which login terminals use |
  | `shell-integration.ts` | the `claude` / `codex` shell functions and the rc-file install |
  | `add-login.ts` | "Add subscription": runs the provider's CLI login into a folder of its own, reports the link and code it prints, types a pasted code into it |
  | `live-feed.ts` | the opt-in Claude Code status-line feed |
  | `tray-model.ts`, `tray.ts` | "Use next: … — x% left", Refresh, Open, Quit |
  | `locale.ts` | the tray's language: the system's at first, then whatever the screens show (`setLocale`); copy in `packages/translations/{locale}/desktop.json` |
  | `ipc.ts`, `ipc-validation.ts` | one handler per channel, arguments parsed, sender checked |
  | `index.ts` | wiring, `--collect-once`, `--smoke` |

- **Preload** (`src/preload/index.ts`) — sandboxed; exposes `window.resetowl`
  (`DesktopBridge`) and nothing else. `version`, `platform`, `apiUrl` and
  `systemLocales` (the OS's preferred languages, best first) arrive as a
  `--resetowl-bridge=` argument.
- **Renderer** — not in this package: the web app's static build, which finds
  `window.resetowl` and talks to `apiUrl` with a bearer token. Its language
  is the one picked on this device, else the system's first supported one
  (`systemLocales`), else English; it reports what it shows, so the tray
  matches.

## The bridge

The contract is `packages/shared/src/desktop/bridge.ts` (`@flama/shared/desktop`):
the `DesktopBridge` type and `DESKTOP_CHANNELS`, the IPC channel names. Every
invoke channel has a handler in `ipc.ts`; `collectorChanged` is pushed from
main whenever the `CollectorStatus` changes. A handler refuses any sender
that is not the app's window on the renderer's origin, and parses its
arguments first (provider ∈ `PROVIDER_IDS`, bounded strings, absolute folders,
http(s)-only URLs).

## What it reads, and what it never does

- Reads the local logins `@flama/usage-providers` documents: Claude Code
  config folders and Codex homes, their identity files, their session logs for
  token counts, and their credentials **only** to call that provider's own
  usage endpoint.
- **Never** refreshes a provider credential, and **never** sends one anywhere:
  the API receives identity, plan, limit windows and token counts.
- Calls ResetOwl's API as `resetowl-desktop/<version> (<platform>)`. Usage
  requests to the vendors carry the client headers Orca sends (see
  `packages/usage-providers`), through Electron's network stack.
- The API token is ResetOwl's own session, encrypted with the OS keystore;
  without one it is kept in memory only. It is never logged.
- **Opt-in and reversible:**
  - *Shell integration* is written only on `shell.install()`, inside
    `# >>> resetowl >>>` / `# <<< resetowl <<<` in `~/.zshrc` or `~/.bashrc`
    (by `$SHELL`); a second install replaces the block, deleting it undoes it.
    On Windows the PowerShell snippet is returned for the person to paste.
  - *Live feed* sets `statusLine` in a Claude Code folder's `settings.json`
    only when there is none, and removes it only when it is ResetOwl's.
- Switching accounts is a pointer file, not a credential copy. The default
  login's pointer is an empty file: setting `CLAUDE_CONFIG_DIR` even to
  `~/.claude` would change the macOS Keychain item Claude Code reads.

### Active pointers and the shell

`~/.resetowl/active/claude-code` and `~/.resetowl/active/codex` hold the
absolute home of the active login, or nothing for the default. The shell
functions read them on every call:

```sh
function claude {
  local _resetowl_home; _resetowl_home="$(cat ~/.resetowl/active/claude-code 2>/dev/null)"
  if [ -n "$_resetowl_home" ]; then CLAUDE_CONFIG_DIR="$_resetowl_home" command claude "$@"
  else command claude "$@"; fi
}
```

After each sync the server's `isActive` flags are written to the pointers
(the server is the source of truth); `accounts.activate` writes one directly
for a login on this machine and is a no-op otherwise.

### Live feed

A server on `127.0.0.1:<random port>` with a random bearer secret accepts
`POST /statusline/claude`. `userData/statusline.sh` (rewritten each launch with
the port and secret, mode 0700) posts its stdin there with `curl -s -m 2` and
the header `X-Claude-Config-Dir: ${CLAUDE_CONFIG_DIR:-$HOME/.claude}`, then
prints an empty line — so the status bar shows nothing, and when ResetOwl is
not running the script costs at most two seconds and fails silently. A payload
with `rate_limits` becomes a sync for that login with `snapshot.source='live'`
and no token rows, at most once a minute per login.

## Commands

```bash
# flama:begin web
pnpm --filter @flama/web build          # the screens, into apps/web/dist (needed by package and the default window)
# flama:end web
pnpm --filter @flama/desktop build      # bundle main + preload into dist/ (esbuild), draw the tray and app icons
pnpm --filter @flama/desktop dev        # build, then open loading RESETOWL_RENDERER_URL (default http://localhost:3000)
pnpm desktop:dev                        # the same, from the root
pnpm --filter @flama/desktop start      # open, serving the built screens on app://resetowl/
pnpm --filter @flama/desktop test       # vitest
pnpm --filter @flama/desktop typecheck
pnpm --filter @flama/desktop package    # electron-builder: mac dmg+zip, win nsis, linux AppImage → release/
pnpm --filter @flama/desktop package:dir   # unpacked app only, quicker
```

`package` refuses to run until the screens are built; they are copied into
the app's `resources/renderer`.

### Name and icon

The app is **ResetOwl** everywhere: `productName` in `package.json` (the name
Electron runs under, unpackaged too) and in `electron-builder.json`. The owl
icons are drawn by `scripts/build.mjs` into `dist/assets/`: `icon.png` (the
window, the macOS dock in development, the Windows `.ico`), `icon-mac.png`
(inset on Apple's grid, the `.icns`), `icons/<n>x<n>.png` (Linux) and the tray
images.

A Linux desktop names a window and picks its icon from the `.desktop` file
named after the window's app id, which Electron takes from `desktopName`
(`resetowl.desktop`); the package ships that file (`linux.syncDesktopName`).
An unpackaged run has none, so the dock shows a generic icon until you add
one for this checkout (it opens the app as `pnpm desktop:dev` does, with
`--dev`) — opt-in, under `~/.local/share`, removed by the second
command and never over an installed ResetOwl's:

```bash
pnpm --filter @flama/desktop desktop-entry:install
pnpm --filter @flama/desktop desktop-entry:uninstall
```

### Diagnostics

```bash
# Print the SyncAccountsInput this machine would send (no window, no API call).
electron apps/desktop --collect-once
# On Linux without a display add: --ozone-platform=headless --disable-gpu

# Open the window, wait for it to load, print `SMOKE_OK <title> (bridge: <apiUrl>)`, exit 0 (1 on failure within 30s).
xvfb-run -a electron apps/desktop --no-sandbox --smoke
```

(`--no-sandbox` is only for running as root in a container.)

## Environment

Read from the process environment (the root `.env` is not loaded by the
desktop app; set them in the shell that launches it).

| Variable | Default | What it does |
| --- | --- | --- |
| `RESETOWL_API_URL` | `http://127.0.0.1:3001` unpackaged, `https://api.resetowl.com` packaged | The API the collector syncs to and the screens call |
| `RESETOWL_RENDERER_URL` | unset (`http://localhost:3000` with `--dev`) | Load the screens from a dev server instead of `app://resetowl/` |

The API must allow the origin `app://resetowl` (CORS and Better Auth trusted
origins).

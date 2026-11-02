# @flama/desktop — Subtrack

The Subtrack desktop app: an Electron shell for people with several personal
Claude Code and Codex subscriptions who want to use up what they pay for. It
reads the logins on this machine, sends their limits and token counts to the
Subtrack API, keeps a tray entry saying which account to use next, and lets a
terminal follow the account marked active.

## Architecture

```
┌──────────── main process (src/main) ────────────┐      ┌──── renderer ────┐
│ collector ── usage-providers ── local logins    │      │ the web app's    │
│     │  └── POST /api/v1/accounts/sync (bearer)  │ IPC  │ build, served on │
│ pointers / shell integration / live feed / tray │◄────►│ app://subtrack/  │
│ token store (safeStorage)                       │      │ window.subtrack  │
└─────────────────────────────────────────────────┘      └──────────────────┘
                        ▲ preload (src/preload): contextBridge, ipcRenderer.invoke only
```

- **Main** (`src/main/`) — one small module per job, each tested without
  Electron where it can be (fs, clock, fetch, spawn and timers are injected):

  | Module | Job |
  | --- | --- |
  | `config.ts` | API URL, renderer URL, honest user agent, run mode, CSP |
  | `window.ts`, `renderer-files.ts` | the `app://subtrack/` scheme (SPA fallback, CSP on HTML), the window and its navigation guards |
  | `token-store.ts` | the API session token, `safeStorage`-encrypted in `userData/session.bin` |
  | `local-logins.ts` | reads every login (`@flama/usage-providers`), builds `SyncAccountsInput` |
  | `api-client.ts` | `POST /api/v1/accounts/sync` |
  | `collector.ts` | the loop: every 10 min, refresh (≤1/min), backoff, 401, rate-limit pause, live sends |
  | `pointers.ts` | `~/.subtrack/active/<provider>`, which login terminals use |
  | `shell-integration.ts` | the `claude` / `codex` shell functions and the rc-file install |
  | `add-login.ts` | "Add account": runs the provider's CLI login into a folder of its own |
  | `live-feed.ts` | the opt-in Claude Code status-line feed |
  | `tray-model.ts`, `tray.ts` | "Use next: … — x% left", Refresh, Open, Quit |
  | `ipc.ts`, `ipc-validation.ts` | one handler per channel, arguments parsed, sender checked |
  | `index.ts` | wiring, `--collect-once`, `--smoke` |

- **Preload** (`src/preload/index.ts`) — sandboxed; exposes `window.subtrack`
  (`DesktopBridge`) and nothing else. `version`, `platform` and `apiUrl`
  arrive as a `--subtrack-bridge=` argument.
- **Renderer** — not in this package: the web app's static build, which finds
  `window.subtrack` and talks to `apiUrl` with a bearer token.

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
- Introduces itself honestly: `subtrack-desktop/<version> (<platform>)`, never
  as claude-code or codex.
- The API token is Subtrack's own session, encrypted with the OS keystore;
  without one it is kept in memory only. It is never logged.
- **Opt-in and reversible:**
  - *Shell integration* is written only on `shell.install()`, inside
    `# >>> subtrack >>>` / `# <<< subtrack <<<` in `~/.zshrc` or `~/.bashrc`
    (by `$SHELL`); a second install replaces the block, deleting it undoes it.
    On Windows the PowerShell snippet is returned for the person to paste.
  - *Live feed* sets `statusLine` in a Claude Code folder's `settings.json`
    only when there is none, and removes it only when it is Subtrack's.
- Switching accounts is a pointer file, not a credential copy. The default
  login's pointer is an empty file: setting `CLAUDE_CONFIG_DIR` even to
  `~/.claude` would change the macOS Keychain item Claude Code reads.

### Active pointers and the shell

`~/.subtrack/active/claude-code` and `~/.subtrack/active/codex` hold the
absolute home of the active login, or nothing for the default. The shell
functions read them on every call:

```sh
function claude {
  local _subtrack_home; _subtrack_home="$(cat ~/.subtrack/active/claude-code 2>/dev/null)"
  if [ -n "$_subtrack_home" ]; then CLAUDE_CONFIG_DIR="$_subtrack_home" command claude "$@"
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
prints an empty line — so the status bar shows nothing, and when Subtrack is
not running the script costs at most two seconds and fails silently. A payload
with `rate_limits` becomes a sync for that login with `snapshot.source='live'`
and no token rows, at most once a minute per login.

## Commands

```bash
# flama:begin web
pnpm --filter @flama/web build          # the screens, into apps/web/dist (needed by package and the default window)
# flama:end web
pnpm --filter @flama/desktop build      # bundle main + preload into dist/ (esbuild), draw tray icons
pnpm --filter @flama/desktop dev        # build, then open loading SUBTRACK_RENDERER_URL (default http://localhost:3000)
pnpm desktop:dev                        # the same, from the root
pnpm --filter @flama/desktop start      # open, serving the built screens on app://subtrack/
pnpm --filter @flama/desktop test       # vitest
pnpm --filter @flama/desktop typecheck
pnpm --filter @flama/desktop package    # electron-builder: mac dmg+zip, win nsis, linux AppImage → release/
pnpm --filter @flama/desktop package:dir   # unpacked app only, quicker
```

`package` refuses to run until the screens are built; they are copied into
the app's `resources/renderer`.

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
| `SUBTRACK_API_URL` | `http://127.0.0.1:3001` unpackaged, `https://api.subtrack.app` packaged | The API the collector syncs to and the screens call |
| `SUBTRACK_RENDERER_URL` | unset (`http://localhost:3000` with `--dev`) | Load the screens from a dev server instead of `app://subtrack/` |

The API must allow the origin `app://subtrack` (CORS and Better Auth trusted
origins).

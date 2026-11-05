import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddLoginResult, LoginProgress } from '@flama/shared/desktop';
import type { LoginCommand } from '@flama/usage-providers';

/**
 * "Add account": signs a new login into a folder of its own by running the
 * provider's CLI login (`claude auth login`, `codex login --device-auth`) with
 * `CLAUDE_CONFIG_DIR` / `CODEX_HOME` pointed there. ResetOwl passes on what
 * the CLI gives (Claude's automatic link, caught through `$BROWSER`, and its
 * manual one; Codex's page and one-time code) so the screens can offer them,
 * types a code the person pastes into the CLI's own prompt, and waits for it
 * to exit with an account in the folder. The credentials it writes stay in
 * that folder and are never read for anything but the provider's own usage
 * endpoint.
 */

/** Codex's one-time code lasts 15 minutes; Claude's sign-in gets the same. */
export const LOGIN_TIMEOUT_MS = 15 * 60_000;
const PATH_MARKER = '__RESETOWL_PATH__';
/** How often the captured browser link is looked for. */
const CAPTURE_POLL_MS = 250;
const BROWSER_SCRIPT = 'browser.sh';
const BROWSER_LINK = 'browser-link';

/**
 * What `$BROWSER` runs: it keeps the link it is handed and opens nothing, so
 * no browser signed in to another account takes the sign-in. The link file
 * sits beside the script, so the script names no path of its own.
 */
const BROWSER_SCRIPT_BODY = `#!/bin/sh
# ResetOwl: keeps the sign-in link the CLI would open, for the app to offer.
printf '%s' "$1" > "$(dirname "$0")/${BROWSER_LINK}"
`;

/**
 * Lines a CLI prints when the sign-in has failed for good: an authorization
 * the person denied, a code that was not accepted, an OAuth error. The run
 * ends there instead of waiting out the timer.
 */
const FAILURE_LINE =
  /^.*(?:\baccess_denied\b|authorization (?:was )?denied|login failed|oauth error).*$/im;

/** Drops terminal escapes (colours, OSC 8 hyperlinks) from CLI output. */
export function stripTerminal(text: string): string {
  return (
    text
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal escapes is the point
      .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal escapes is the point
      .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
  );
}

/**
 * What a login printed so far that the screens can show: the link it printed
 * (Claude's manual link, Codex's device page) and Codex's one-time code,
 * which the CLI prints on the line after the one that names it.
 */
export function readProgress(output: string): { link: string | null; code: string | null } {
  const text = stripTerminal(output);
  const link = extractUrls(text)[0] ?? null;
  const code = text.match(/one-time code[^\n]*\n\s*([A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+)/)?.[1] ?? null;
  return { link, code };
}

/** The line saying the sign-in failed, once the CLI has printed one. */
export function readFailure(output: string): string | null {
  const line = stripTerminal(output).match(FAILURE_LINE)?.[0]?.trim();
  return line ? line.slice(0, 300) : null;
}

/**
 * A link `$BROWSER` was handed, if it is the automatic one: https, with its
 * `redirect_uri` on this computer, so opening it anywhere else would fail.
 */
export function acceptBrowserLink(raw: string): string | null {
  const link = raw.trim();
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:') return null;
    const back = new URL(url.searchParams.get('redirect_uri') ?? '');
    if (back.protocol !== 'http:') return null;
    return back.hostname === 'localhost' || back.hostname === '127.0.0.1' ? link : null;
  } catch {
    return null;
  }
}

/** Finds https URLs in CLI output, without trailing punctuation. */
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/https:\/\/[^\s"'<>`]+/g)) {
    out.push(match[0].replace(/[).,;:\]]+$/, ''));
  }
  return out;
}

/**
 * PATH as the person's login shell sets it: an app started from the Dock or a
 * launcher gets a bare PATH that misses `~/.local/bin`, Homebrew and nvm.
 */
export function loginShellPath(
  shell: string | undefined,
  fallback: string | undefined,
  platform: NodeJS.Platform = process.platform,
): Promise<string | undefined> {
  if (platform === 'win32' || !shell) return Promise.resolve(fallback);
  return new Promise((done) => {
    execFile(
      shell,
      ['-ilc', `printf '%s%s%s' '${PATH_MARKER}' "$PATH" '${PATH_MARKER}'`],
      { timeout: 5_000, windowsHide: true, env: process.env },
      (err, stdout) => {
        const match = String(stdout ?? '').match(
          new RegExp(`${PATH_MARKER}(.*?)${PATH_MARKER}`, 's'),
        );
        done(!err && match?.[1] ? match[1] : fallback);
      },
    );
  });
}

export interface AddLoginDeps {
  managedRoot: string;
  provider: string;
  command: (home: string) => LoginCommand;
  /**
   * Run after the CLI exits 0: why the folder does not hold a new account
   * (none signed in, or one already on this machine), or null when it does.
   * A reason fails the sign-in and the folder is removed.
   */
  check?(home: string): Promise<string | null>;
  /** Called each time what the screens can show changes. */
  onProgress?(progress: LoginProgress): void;
  env: Record<string, string | undefined>;
  spawn?: typeof spawn;
  timeoutMs?: number;
  /** Where the `$BROWSER` script goes; a private folder is made in it. */
  tmpRoot?: string;
  platform?: NodeJS.Platform;
  log?: (line: string) => void;
}

/** A login in flight: its outcome, and the two things the screens can do to it. */
export interface LoginHandle {
  result: Promise<AddLoginResult>;
  /** Types a code the person pasted into the CLI's own prompt. */
  submitCode(code: string): void;
  /** Stops the CLI; the result then says the sign-in was cancelled. */
  cancel(): void;
}

/**
 * Writes the `$BROWSER` script into a private folder of its own. It is not
 * the account's folder: that sits under the app's data folder, which has a
 * space in it on macOS, and a CLI may split `$BROWSER` on spaces.
 */
async function browserCapture(root: string): Promise<{ dir: string; script: string }> {
  const dir = await mkdtemp(join(root, 'resetowl-login-'));
  const script = join(dir, BROWSER_SCRIPT);
  await writeFile(script, BROWSER_SCRIPT_BODY, { mode: 0o700 });
  await chmod(script, 0o700);
  return { dir, script };
}

export function startLogin(deps: AddLoginDeps): LoginHandle {
  let child: ChildProcess | null = null;
  let stop: () => void = () => undefined;
  let cancelled = false;
  let pending: string | null = null;
  const result = (async () => {
    const home = join(deps.managedRoot, deps.provider, randomBytes(6).toString('hex'));
    await mkdir(home, { recursive: true, mode: 0o700 });
    const cmd = deps.command(home);
    const doSpawn = deps.spawn ?? spawn;
    const timeoutMs = deps.timeoutMs ?? LOGIN_TIMEOUT_MS;
    const platform = deps.platform ?? process.platform;
    // A shell script for `$BROWSER` needs a shell; elsewhere the CLI opens
    // the browser itself and its printed link is the one on offer.
    const capture =
      cmd.capturesBrowser && platform !== 'win32'
        ? await browserCapture(deps.tmpRoot ?? tmpdir()).catch(() => null)
        : null;
    // Its own process group, so a wrapper (node, mise) cannot leave the real
    // CLI behind, holding the localhost port, when the run is stopped.
    const group = platform !== 'win32';

    let outcome = await new Promise<AddLoginResult>((done) => {
      if (cancelled) {
        done({ ok: false, message: 'Sign-in cancelled.' });
        return;
      }
      try {
        // stdin is a pipe, not closed: Claude Code only prints its manual
        // link and reads a pasted code when it has somewhere to read from.
        child = doSpawn(cmd.command, cmd.args, {
          env: { ...deps.env, ...cmd.env, ...(capture ? { BROWSER: capture.script } : {}) },
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: group,
          windowsHide: true,
        });
      } catch (err) {
        done({ ok: false, message: err instanceof Error ? err.message : String(err) });
        return;
      }
      const running = child;
      const killGroup = () => {
        if (!group || !running.pid) return false;
        try {
          process.kill(-running.pid, 'SIGTERM');
          return true;
        } catch {
          return false; // the group is gone already
        }
      };
      stop = () => {
        if (!killGroup()) running.kill();
      };
      const deadline = new Date(Date.now() + timeoutMs).toISOString();
      let settled = false;
      let output = '';
      let captured: string | null = null;
      let last = '';
      const report = () => {
        const printed = readProgress(output);
        const progress: LoginProgress = capture
          ? { link: captured, codeLink: printed.link, code: printed.code, deadline }
          : { link: printed.link, codeLink: null, code: printed.code, deadline };
        const key = JSON.stringify(progress);
        if (key === last) return;
        last = key;
        deps.onProgress?.(progress);
      };
      const finish = (value: AddLoginResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearInterval(poll);
        done(value);
      };
      const timer = setTimeout(() => {
        stop();
        finish({ ok: false, message: 'Sign-in did not finish within 15 minutes.' });
      }, timeoutMs);
      const poll = setInterval(() => {
        if (!capture || captured) return;
        void readFile(join(capture.dir, BROWSER_LINK), 'utf8').then(
          (raw) => {
            const link = acceptBrowserLink(raw);
            if (!link || captured || settled) return;
            captured = link;
            report();
          },
          () => undefined, // not handed over yet
        );
      }, CAPTURE_POLL_MS);
      const onOutput = (chunk: Buffer) => {
        output += chunk.toString('utf8');
        const failure = readFailure(output);
        if (failure) {
          stop();
          finish({ ok: false, message: failure });
          return;
        }
        report();
      };
      report();
      running.stdout?.on('data', onOutput);
      running.stderr?.on('data', onOutput);
      running.stdin?.on('error', () => undefined);
      if (pending !== null) running.stdin?.write(`${pending}\n`);
      running.on('error', (err: NodeJS.ErrnoException) => {
        finish({
          ok: false,
          message:
            err.code === 'ENOENT'
              ? `\`${cmd.command}\` is not installed or not on your PATH.`
              : err.message,
        });
      });
      running.on('exit', (code, signal) => {
        // Whatever the CLI left running in its group goes with it.
        killGroup();
        if (code === 0) finish({ ok: true, message: null });
        else if (cancelled) finish({ ok: false, message: 'Sign-in cancelled.' });
        else
          finish({
            ok: false,
            message: `\`${cmd.command} ${cmd.args.join(' ')}\` exited with ${code ?? signal}.`,
          });
      });
    });

    if (capture) await rm(capture.dir, { recursive: true, force: true }).catch(() => undefined);
    // An exit 0 is not a sign-in until the folder names a new account.
    if (outcome.ok && deps.check) {
      const reason = await deps
        .check(home)
        .catch((err: unknown) => (err instanceof Error ? err.message : String(err)));
      if (reason) outcome = { ok: false, message: reason };
    }
    if (!outcome.ok) {
      // The folder is ours and minutes old; a failed sign-in leaves nothing to keep.
      await rm(home, { recursive: true, force: true }).catch(() => undefined);
      deps.log?.(`add login (${deps.provider}) failed: ${outcome.message}`);
    }
    return outcome;
  })();

  return {
    result,
    submitCode(code) {
      const line = code.trim();
      if (!line) return;
      if (child?.stdin) child.stdin.write(`${line}\n`);
      else pending = line;
    },
    cancel() {
      cancelled = true;
      stop();
    },
  };
}

/** Runs a login to its end, for a caller that needs neither the progress nor a code. */
export function addLogin(deps: AddLoginDeps): Promise<AddLoginResult> {
  return startLogin(deps).result;
}

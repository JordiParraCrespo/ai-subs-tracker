import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { AddLoginResult, LoginProgress } from '@flama/shared/desktop';
import type { LoginCommand } from '@flama/usage-providers';

/**
 * "Add account": signs a new login into a folder of its own by running the
 * provider's CLI login (`claude auth login`, `codex login --device-auth`) with
 * `CLAUDE_CONFIG_DIR` / `CODEX_HOME` pointed there. The CLI does the OAuth and
 * opens the browser itself; ResetOwl reads what it prints (Claude's manual
 * sign-in link, Codex's page and one-time code) so the screens can offer them,
 * types a code the person pastes into the CLI's own prompt, and waits for it
 * to exit. A provider that can say who a folder is signed in as then has the
 * new folder checked (`verify`): no login, or an account already on this
 * machine, removes it and fails with the reason. The credentials it writes
 * stay in that folder and are never read for anything but the provider's own
 * usage endpoint.
 */

/** Codex's one-time code lasts 15 minutes; Claude's sign-in gets the same. */
export const LOGIN_TIMEOUT_MS = 15 * 60_000;
const PATH_MARKER = '__RESETOWL_PATH__';

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
 * What the screens can show from what a login printed so far: the link to
 * sign in at (Claude's manual link, Codex's device page) and Codex's one-time
 * code, which the CLI prints on the line after the one that names it. A link
 * counts once whitespace follows it (output arrives in chunks, so a link
 * without it may still be printing) and, with `linkHosts`, only on those hosts.
 */
export function readProgress(output: string, linkHosts?: readonly string[]): LoginProgress {
  const text = stripTerminal(output);
  const link =
    extractUrls(text).find((url) => !linkHosts || linkHosts.includes(hostOf(url))) ?? null;
  const code =
    text.match(/one-time code[^\n]*\r?\n\s*([A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+)\s/)?.[1] ?? null;
  return { link, code };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Finds complete https URLs (whitespace after them) in CLI output, without trailing punctuation. */
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/https:\/\/[^\s"'<>`]+(?=\s)/g)) {
    out.push(match[0].replace(/[).,;:\]]+$/, ''));
  }
  return out;
}

/** How much of a failed CLI's output a failure message carries. */
const TAIL_CHARS = 2_000;
const TAIL_LINES = 20;

/**
 * The end of what a CLI printed, readable: terminal escapes gone, a line a
 * spinner redrew kept as its last state, blank lines dropped.
 */
export function outputTail(output: string): string {
  const lines = stripTerminal(output)
    .split(/\r?\n/)
    .map((line) => (line.split('\r').pop() ?? '').trimEnd())
    .filter((line) => line.trim() !== '');
  const tail = lines.slice(-TAIL_LINES).join('\n');
  return tail.length <= TAIL_CHARS ? tail : `…${tail.slice(-TAIL_CHARS)}`;
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
   * Checks the folder a sign-in that exited 0 wrote: null keeps it, a
   * message removes it and fails with that message.
   */
  verify?(home: string): Promise<string | null>;
  /** Called each time the link or the code the CLI printed changes. */
  onProgress?(progress: LoginProgress): void;
  env: Record<string, string | undefined>;
  spawn?: typeof spawn;
  timeoutMs?: number;
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

export function startLogin(deps: AddLoginDeps): LoginHandle {
  let child: ChildProcess | null = null;
  let cancelled = false;
  let pending: string | null = null;
  const result = (async () => {
    const home = join(deps.managedRoot, deps.provider, randomBytes(6).toString('hex'));
    await mkdir(home, { recursive: true, mode: 0o700 });
    const cmd = deps.command(home);
    const doSpawn = deps.spawn ?? spawn;
    const timeoutMs = deps.timeoutMs ?? LOGIN_TIMEOUT_MS;

    const outcome = await new Promise<AddLoginResult>((done) => {
      if (cancelled) {
        done({ ok: false, message: 'Sign-in cancelled.' });
        return;
      }
      try {
        // stdin is a pipe, not closed: Claude Code only prints its manual
        // link and reads a pasted code when it has somewhere to read from.
        child = doSpawn(cmd.command, cmd.args, {
          env: { ...deps.env, ...cmd.env },
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (err) {
        done({ ok: false, message: err instanceof Error ? err.message : String(err) });
        return;
      }
      const running = child;
      let settled = false;
      let output = '';
      let last = '';
      const finish = (value: AddLoginResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        done(value);
      };
      const timer = setTimeout(() => {
        running.kill();
        finish({ ok: false, message: 'Sign-in did not finish within 15 minutes.' });
      }, timeoutMs);
      const onOutput = (chunk: Buffer) => {
        output += chunk.toString('utf8');
        const progress = readProgress(output, cmd.linkHosts);
        const key = `${progress.link}|${progress.code}`;
        if (key === last) return;
        last = key;
        deps.onProgress?.(progress);
      };
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
        if (code === 0) finish({ ok: true, message: null });
        else if (cancelled) finish({ ok: false, message: 'Sign-in cancelled.' });
        else {
          // The CLI's own words are the reason (a workspace with device-code
          // sign-in turned off, a network error), so they go with the failure.
          const said = outputTail(output);
          const exited = `\`${cmd.command} ${cmd.args.join(' ')}\` exited with ${code ?? signal}`;
          finish({ ok: false, message: said ? `${exited}:\n${said}` : `${exited}.` });
        }
      });
    });

    let checked = outcome;
    if (outcome.ok && deps.verify) {
      const problem = await deps
        .verify(home)
        .catch((err: unknown) => (err instanceof Error ? err.message : String(err)));
      if (problem) checked = { ok: false, message: problem };
    }

    if (!checked.ok) {
      // The folder is ours and minutes old; a failed sign-in leaves nothing to
      // keep, and a second folder of one account would rotate its tokens.
      await rm(home, { recursive: true, force: true }).catch(() => undefined);
      deps.log?.(`add login (${deps.provider}) failed: ${checked.message}`);
    }
    return checked;
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
      child?.kill();
    },
  };
}

/** Runs a login to its end, for a caller that needs neither the progress nor a code. */
export function addLogin(deps: AddLoginDeps): Promise<AddLoginResult> {
  return startLogin(deps).result;
}

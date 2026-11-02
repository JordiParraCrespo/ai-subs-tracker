import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { AddLoginResult } from '@flama/shared/desktop';
import type { LoginCommand } from '@flama/usage-providers';

/**
 * "Add account": signs a new login into a folder of its own by running the
 * provider's CLI login (`claude auth login`, `codex login`) with
 * `CLAUDE_CONFIG_DIR` / `CODEX_HOME` pointed there. The CLI does the OAuth;
 * Subtrack only opens the https URL it prints and waits for it to exit. The
 * credentials it writes stay in that folder and are never read for anything
 * but the provider's own usage endpoint.
 */

export const LOGIN_TIMEOUT_MS = 10 * 60_000;
const PATH_MARKER = '__SUBTRACK_PATH__';

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
  openUrl(url: string): void;
  env: Record<string, string | undefined>;
  spawn?: typeof spawn;
  timeoutMs?: number;
  log?: (line: string) => void;
}

export async function addLogin(deps: AddLoginDeps): Promise<AddLoginResult> {
  const home = join(deps.managedRoot, deps.provider, randomBytes(6).toString('hex'));
  await mkdir(home, { recursive: true, mode: 0o700 });
  const cmd = deps.command(home);
  const doSpawn = deps.spawn ?? spawn;
  const timeoutMs = deps.timeoutMs ?? LOGIN_TIMEOUT_MS;

  const result = await new Promise<AddLoginResult>((done) => {
    let child: ChildProcess;
    try {
      child = doSpawn(cmd.command, cmd.args, {
        env: { ...deps.env, ...cmd.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (err) {
      done({ ok: false, message: err instanceof Error ? err.message : String(err) });
      return;
    }
    const opened = new Set<string>();
    let settled = false;
    const finish = (value: AddLoginResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, message: 'Sign-in did not finish within 10 minutes.' });
    }, timeoutMs);
    const onOutput = (chunk: Buffer) => {
      for (const url of extractUrls(chunk.toString('utf8'))) {
        if (opened.has(url)) continue;
        opened.add(url);
        deps.openUrl(url);
      }
    };
    child.stdout?.on('data', onOutput);
    child.stderr?.on('data', onOutput);
    child.on('error', (err: NodeJS.ErrnoException) => {
      finish({
        ok: false,
        message:
          err.code === 'ENOENT'
            ? `\`${cmd.command}\` is not installed or not on your PATH.`
            : err.message,
      });
    });
    child.on('exit', (code, signal) => {
      if (code === 0) finish({ ok: true, message: null });
      else
        finish({
          ok: false,
          message: `\`${cmd.command} ${cmd.args.join(' ')}\` exited with ${code ?? signal}.`,
        });
    });
  });

  if (!result.ok) {
    // The folder is ours and seconds old; a failed sign-in leaves nothing to keep.
    await rm(home, { recursive: true, force: true }).catch(() => undefined);
    deps.log?.(`add login (${deps.provider}) failed: ${result.message}`);
  }
  return result;
}

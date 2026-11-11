import { type ChildProcess, spawn as nodeSpawn } from 'node:child_process';
import { cleanCliEnv, type LoginCommand } from '@flama/usage-providers';
import { stripTerminal } from './add-login';

/**
 * Lets the vendor's own CLI renew a login whose short-lived access token has
 * lapsed. ResetOwl runs `claude auth status` (the provider's `refreshCommand`)
 * with stdin closed and a timeout: it reports the login as JSON and, as a side
 * effect, refreshes the token and rewrites the credential file. ResetOwl never
 * calls `oauth/token` and never writes a credential itself — Claude Code does.
 *
 * macOS note: for the default `~/.claude` the command carries no
 * `CLAUDE_CONFIG_DIR` (the provider's `launchEnv` is `{}`), so Claude Code
 * reads and rewrites the Keychain item it would use in a terminal. That
 * Keychain write is not something these tests can exercise on Linux; it is
 * covered by the env the command is given, which the provider's own specs pin.
 */

/** How long `auth status` may run before it is given up on. */
export const REFRESH_TIMEOUT_MS = 30_000;

export type RenewOutcome =
  /** The CLI ran and the login is good; the token was refreshed on disk. */
  | 'renewed'
  /** The CLI reported the login signed out (`loggedIn: false`): sign in again. */
  | 'signed_out'
  /** The CLI could not run (not installed, timed out, or an unclear failure). */
  | 'unavailable';

export interface RenewDeps {
  /** The base environment the CLI inherits (PATH as a login shell sets it). */
  env: Record<string, string | undefined>;
  spawn?: typeof nodeSpawn;
  timeoutMs?: number;
  log?: (line: string) => void;
}

/**
 * The inherited environment, without what picks a login or carries another
 * session's identity (`cleanCliEnv`, the list Orca strips): the refresh
 * command's own env (the provider's `launchEnv`) is the only thing that
 * selects the login. For the default login `launchEnv` is `{}`, and an
 * inherited `CLAUDE_CONFIG_DIR` left in place would point the CLI at another
 * folder — which would also change the macOS Keychain item it reads — and an
 * inherited `CLAUDE_CODE_OAUTH_TOKEN` would make it report another login.
 */
function baseEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  return cleanCliEnv(env);
}

/** `true` / `false` from a `"loggedIn": <bool>` field anywhere in the output. */
function loggedInFlag(output: string): boolean | null {
  const match = stripTerminal(output).match(/"loggedIn"\s*:\s*(true|false)/);
  if (!match) return null;
  return match[1] === 'true';
}

/**
 * Runs the provider's refresh command once and says what it found. Never
 * throws: a spawn that cannot start is `unavailable`, like a timeout.
 */
export function runRefresh(cmd: LoginCommand, deps: RenewDeps): Promise<RenewOutcome> {
  const doSpawn = deps.spawn ?? nodeSpawn;
  const timeoutMs = deps.timeoutMs ?? REFRESH_TIMEOUT_MS;
  return new Promise<RenewOutcome>((done) => {
    let child: ChildProcess;
    try {
      child = doSpawn(cmd.command, cmd.args, {
        // The login is selected only by `cmd.env`; an inherited selector or
        // session identity must not leak through (see baseEnv).
        env: { ...baseEnv(deps.env), ...cmd.env },
        // stdin closed: `auth status` neither prompts nor reads a code.
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (err) {
      deps.log?.(`refresh (${cmd.command}) could not start: ${String(err)}`);
      done('unavailable');
      return;
    }
    let output = '';
    let settled = false;
    const finish = (outcome: RenewOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(outcome);
    };
    const timer = setTimeout(() => {
      child.kill();
      deps.log?.(`refresh (${cmd.command}) timed out`);
      finish('unavailable');
    }, timeoutMs);
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      deps.log?.(`refresh (${cmd.command}) failed: ${err.code ?? err.message}`);
      finish('unavailable');
    });
    child.on('exit', (code) => {
      const loggedIn = loggedInFlag(output);
      // A definitive "signed out" is the only thing that moves a renewable
      // login to auth_expired; an unclear non-zero exit stays stale and is
      // retried after a backoff, so a transient failure never nags the user.
      if (loggedIn === false) finish('signed_out');
      else if (code === 0) finish('renewed');
      else finish('unavailable');
    });
  });
}

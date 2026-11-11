import { execFile, spawn } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import type { CliChild, ProviderEnv } from './types';

export interface NodeProviderEnvOptions {
  /** Where ResetOwl keeps isolated homes for extra accounts. */
  managedRoot: string;
  /** Honest, e.g. `resetowl-desktop/0.1.0`. */
  userAgent: string;
  home?: string;
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: () => Date;
  /**
   * The environment a vendor CLI is started with (PATH as the login shell
   * sets it). Given, `spawnCli` runs CLIs; absent, no CLI is run.
   */
  cliEnv?: Record<string, string | undefined>;
}

/**
 * The env vars that pick a login or carry another session's identity: a CLI
 * ResetOwl starts is pointed at its login by the env it is given and nothing
 * it inherits, as Orca strips them.
 */
export const INHERITED_SESSION_ENV = [
  'CLAUDE_CONFIG_DIR',
  'CODEX_HOME',
  'GROK_HOME',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'AWS_BEARER_TOKEN_BEDROCK',
  'CLAUDECODE',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_BRIDGE_SESSION_ID',
  'CLAUDE_CODE_HOST_SESSION_ID',
  'CLAUDE_CODE_SESSION_ATTENDED',
  'CLAUDE_CODE_MESSAGING_SOCKET',
  'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_EXECPATH',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_DESKTOP_APP_VERSION',
  'CLAUDE_EFFORT',
  'CLAUDE_PID',
  'CLAUDE_AGENT_SDK_VERSION',
] as const;

/** `env` without the inherited login selectors and session identity. */
export function cleanCliEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const clean = { ...env };
  for (const key of INHERITED_SESSION_ENV) delete clean[key];
  return clean;
}

const KEYCHAIN_TIMEOUT_MS = 10_000;

/**
 * Reads a macOS generic password by service name and, when given, account;
 * null when absent or on failure.
 */
export function readMacKeychain(service: string, account?: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      '/usr/bin/security',
      ['find-generic-password', '-s', service, ...(account ? ['-a', account] : []), '-w'],
      { timeout: KEYCHAIN_TIMEOUT_MS, windowsHide: true },
      (err, stdout) => resolve(err ? null : stdout.trim() || null),
    );
  });
}

/** A ProviderEnv over the real machine. */
export function nodeProviderEnv(opts: NodeProviderEnvOptions): ProviderEnv {
  const platform = opts.platform ?? process.platform;
  return {
    home: opts.home ?? homedir(),
    platform,
    env: opts.env ?? process.env,
    now: opts.now ?? (() => new Date()),
    fetch: opts.fetch ?? globalThis.fetch.bind(globalThis),
    userAgent: opts.userAgent,
    managedRoot: opts.managedRoot,
    readKeychain: platform === 'darwin' ? readMacKeychain : async () => null,
    ...(opts.cliEnv ? { spawnCli: cliSpawner(opts.cliEnv) } : {}),
  };
}

/** Starts a CLI with piped stdio, outside any account folder, in its own env. */
function cliSpawner(
  base: Record<string, string | undefined>,
): NonNullable<ProviderEnv['spawnCli']> {
  return (command, args, env): CliChild =>
    spawn(command, [...args], {
      env: { ...cleanCliEnv(base), ...env },
      cwd: tmpdir(),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      // `codex` is an npm shim (`codex.cmd`) on Windows.
      shell: process.platform === 'win32',
    });
}

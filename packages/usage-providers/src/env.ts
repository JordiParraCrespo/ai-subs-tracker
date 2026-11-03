import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import type { ProviderEnv } from './types';

export interface NodeProviderEnvOptions {
  /** Where Subtrack keeps isolated homes for extra accounts. */
  managedRoot: string;
  /** Honest, e.g. `subtrack-desktop/0.1.0`. */
  userAgent: string;
  home?: string;
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: () => Date;
}

const KEYCHAIN_TIMEOUT_MS = 10_000;

/** Reads a macOS generic password by service name; null when absent or on failure. */
export function readMacKeychain(service: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      '/usr/bin/security',
      ['find-generic-password', '-s', service, '-w'],
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
  };
}

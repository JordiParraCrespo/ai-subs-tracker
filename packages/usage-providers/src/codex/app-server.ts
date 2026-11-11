import type { ExtraUsage, LimitWindow } from '@flama/shared/schemas/accounts';
import { isRecord, type JsonRecord, num, str, toIso } from '../lib/util';
import type { CliChild, ProviderEnv } from '../types';
import { codexWindow, sortCodexWindows } from './usage-api';

/**
 * The Codex usage read Orca makes, and the way a Codex login renews: Codex's
 * own CLI started as a short-lived JSON-RPC server (`codex app-server`),
 * asked `account/rateLimits/read`. To answer, the CLI refreshes its own
 * access token when it has lapsed and rewrites `auth.json` — ResetOwl never
 * calls `oauth/token` and never writes a credential.
 *
 * The flags are Orca's: no approvals, plugins off (a marketplace clone could
 * outlive the probe), read-only sandbox. One probe runs per Codex home at a
 * time, since two CLIs refreshing one login race on its rotating refresh
 * token.
 */
export const CODEX_PROBE_ARGS = [
  '-c',
  'approval_policy=never',
  '-c',
  'features.plugins=false',
  '-s',
  'read-only',
  '-a',
  'never',
  'app-server',
] as const;

export const RPC_INIT_TIMEOUT_MS = 30_000;
export const RPC_TIMEOUT_MS = 10_000;
/** How long a probe has to exit after SIGTERM before SIGKILL, and after SIGKILL. */
export const PROBE_TERM_GRACE_MS = 5_000;
export const PROBE_KILL_GRACE_MS = 2_000;
const MAX_STDERR = 100_000;

/** What the CLI prints when its login cannot be renewed: only a new sign-in helps. */
const CODEX_AUTH_ERROR_PATTERNS = [
  /access token could not be refreshed/i,
  /authentication session could not be refreshed/i,
  /refresh token (?:has expired|was already used|was revoked)/i,
  /you have since logged out or signed in to another account/i,
  /please (?:log out and )?sign in again/i,
  /please reauthenticate/i,
  /not logged in/i,
  /sign in with chatgpt/i,
  /token data is not available/i,
  /auth (?:is missing|tokens are missing|does not expose)/i,
  /chatgpt authentication required/i,
];

/** The fixed words shown for a login the CLI could not renew. */
export const CODEX_SIGNED_OUT_MESSAGE =
  'Your ChatGPT session could not be refreshed. Please sign in again.';

// biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal escapes is the point
const ANSI = /\u001b\[[0-9;]*[a-zA-Z]/g;

export function isCodexAuthError(text: string | null | undefined): boolean {
  if (!text) return false;
  return text
    .replace(ANSI, '')
    .split(/\r?\n|\r/)
    .some((line) => CODEX_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(line.trim())));
}

export type CodexRpcResult =
  | {
      kind: 'ok';
      planType: string | null;
      windows: LimitWindow[];
      extraUsage: ExtraUsage | null;
    }
  /** The CLI said the login cannot be renewed: sign in again. */
  | { kind: 'signed_out' }
  /** The CLI is not installed or may not run here. */
  | { kind: 'unavailable'; message: string }
  | { kind: 'failed'; message: string };

function rpcWindow(key: string, value: unknown): LimitWindow | null {
  if (!isRecord(value)) return null;
  const minutes = num(value.windowDurationMins);
  return codexWindow(key, {
    usedPercent: value.usedPercent,
    minutes: minutes !== null && minutes > 0 ? minutes : null,
    resetsAt: toIso(value.resetsAt),
  });
}

/** Pay-as-you-go credits, shown only for an account that has them (Orca's rule). */
function rpcCredits(value: unknown): ExtraUsage | null {
  if (!isRecord(value) || (value.hasCredits !== true && value.unlimited !== true)) return null;
  return {
    enabled: true,
    monthlyLimit: null,
    usedCredits: null,
    utilization: null,
    currency: null,
  };
}

/** `account/rateLimits/read`'s answer as windows: primary and secondary, by their length. */
export function parseCodexRpcRateLimits(result: unknown): Extract<CodexRpcResult, { kind: 'ok' }> {
  const wrapper: JsonRecord = isRecord(result) ? result : {};
  const limits: JsonRecord = isRecord(wrapper.rateLimits) ? wrapper.rateLimits : {};
  const windows = [rpcWindow('primary', limits.primary), rpcWindow('secondary', limits.secondary)]
    .filter((w): w is LimitWindow => w !== null)
    // A window the RPC reports without a percentage is not a reading.
    .filter((w) => w.utilization !== null);
  return {
    kind: 'ok',
    planType: str(limits.planType) ?? str(wrapper.planType),
    windows: sortCodexWindows(windows),
    extraUsage: rpcCredits(limits.credits),
  };
}

/** Probes run per Codex home one at a time; failed runs do not block the next. */
const lockTails = new Map<string, Promise<unknown>>();

export function withCodexHomeLock<T>(home: string, fn: () => Promise<T>): Promise<T> {
  const prior = lockTails.get(home) ?? Promise.resolve();
  const run = prior.then(fn);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  lockTails.set(home, tail);
  void tail.then(() => {
    if (lockTails.get(home) === tail) lockTails.delete(home);
  });
  return run;
}

function rpcMessage(id: number, method: string, params: unknown = {}): string {
  return `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
}

export interface ProbeTimeouts {
  initMs: number;
  rpcMs: number;
  termGraceMs: number;
  killGraceMs: number;
}

const DEFAULT_TIMEOUTS: ProbeTimeouts = {
  initMs: RPC_INIT_TIMEOUT_MS,
  rpcMs: RPC_TIMEOUT_MS,
  termGraceMs: PROBE_TERM_GRACE_MS,
  killGraceMs: PROBE_KILL_GRACE_MS,
};

/**
 * The exchange over one spawned `codex app-server`. Never throws, and only
 * resolves once the process has exited (SIGTERM, then SIGKILL if it lingers):
 * the home's lock must not pass to the next probe while this one may still be
 * refreshing the login with the same rotating refresh token.
 */
export function exchangeRateLimits(
  child: CliChild,
  timeouts: Partial<ProbeTimeouts> = {},
): Promise<CodexRpcResult> {
  const limits = { ...DEFAULT_TIMEOUTS, ...timeouts };
  return new Promise((resolve) => {
    let buffer = '';
    let stderr = '';
    let settled = false;
    let exited = false;
    let onExit: (() => void) | null = null;
    let initId = -1;
    let limitsId = -1;
    let timer: ReturnType<typeof setTimeout> | null = null;

    /** Resolves once the process is gone, or after the grace period if it never says so. */
    const exitWithin = (ms: number) =>
      new Promise<void>((done) => {
        if (exited) {
          done();
          return;
        }
        const wait = setTimeout(done, ms);
        onExit = () => {
          clearTimeout(wait);
          done();
        };
      });
    const signal = (sig: NodeJS.Signals) => {
      try {
        child.kill(sig);
      } catch {
        // gone already
      }
    };

    const settle = (result: CodexRpcResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      void (async () => {
        if (!exited) {
          signal('SIGTERM');
          await exitWithin(limits.termGraceMs);
        }
        if (!exited) {
          signal('SIGKILL');
          await exitWithin(limits.killGraceMs);
        }
        resolve(result);
      })();
    };
    const markExited = () => {
      exited = true;
      onExit?.();
    };
    const arm = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => settle({ kind: 'failed', message: 'Codex did not answer (RPC timeout).' }),
        ms,
      );
    };
    const send = (id: number, method: string) => child.stdin?.write(rpcMessage(id, method));

    arm(limits.initMs);
    child.stdin?.on('error', () => undefined);
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-MAX_STDERR);
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      // A process that could not start has nothing to wait for.
      if (err.code === 'ENOENT') markExited();
      settle(
        err.code === 'ENOENT'
          ? { kind: 'unavailable', message: '`codex` is not installed or not on your PATH.' }
          : { kind: 'failed', message: err.message },
      );
    });
    child.on('close', (code, exitSignal) => {
      markExited();
      if (isCodexAuthError(stderr)) {
        settle({ kind: 'signed_out' });
        return;
      }
      const reason =
        code !== null
          ? `exit code ${code}`
          : exitSignal
            ? `signal ${exitSignal}`
            : 'no exit status';
      settle({ kind: 'failed', message: `Codex RPC process exited (${reason}).` });
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        let message: JsonRecord;
        try {
          const parsed: unknown = JSON.parse(line);
          if (!isRecord(parsed)) continue;
          message = parsed;
        } catch {
          continue; // not part of the protocol stream
        }
        if (message.id === initId) {
          arm(limits.rpcMs);
          child.stdin?.write(
            `${JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} })}\n`,
          );
          limitsId = initId + 1;
          send(limitsId, 'account/rateLimits/read');
          continue;
        }
        if (message.id !== limitsId) continue;
        const error = isRecord(message.error) ? str(message.error.message) : null;
        if (error !== null || isRecord(message.error)) {
          settle(
            isCodexAuthError(error) || isCodexAuthError(stderr)
              ? { kind: 'signed_out' }
              : { kind: 'failed', message: error ?? 'Codex could not read its limits.' },
          );
          return;
        }
        settle(parseCodexRpcRateLimits(message.result));
      }
    });

    initId = 1;
    child.stdin?.write(
      rpcMessage(initId, 'initialize', { clientInfo: { name: 'resetowl', version: '1.0.0' } }),
    );
  });
}

/**
 * Starts `codex app-server` for one home and reads its limits, one probe per
 * home at a time. `unavailable` where no CLI may run (`env.spawnCli` absent).
 */
export function readCodexRateLimitsViaRpc(home: string, env: ProviderEnv): Promise<CodexRpcResult> {
  const spawnCli = env.spawnCli;
  if (!spawnCli) {
    return Promise.resolve({ kind: 'unavailable', message: 'No Codex CLI here.' });
  }
  return withCodexHomeLock(home, async () => {
    let child: CliChild;
    try {
      child = spawnCli('codex', CODEX_PROBE_ARGS, { CODEX_HOME: home });
    } catch (err) {
      return { kind: 'unavailable', message: err instanceof Error ? err.message : String(err) };
    }
    return exchangeRateLimits(child);
  });
}

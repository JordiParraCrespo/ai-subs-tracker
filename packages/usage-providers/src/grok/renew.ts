import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isRecord, type JsonRecord } from '../lib/util';
import type { CliChild, ProviderEnv } from '../types';
import { type GrokAuth, isGrokSessionFresh, readGrokAuth } from './auth';

/**
 * Renews a lapsed Grok Build session the way Orca runs Grok with no window
 * (`src/main/acp/text-task/` in stablyai/orca): the CLI itself, never a token
 * call of ours.
 *
 * 1. `grok --permission-mode default agent --no-leader stdio`, the CLI's ACP
 *    server, with `GROK_STORAGE_MODE=local`: `initialize`, then `authenticate`
 *    with `cached_token`, the method that loads `auth.json` and never prompts.
 *    A CLI that offers only its interactive sign-in has no saved login: the
 *    person signs in again.
 * 2. If `auth.json` is still lapsed, Orca's headless one-shot task: a prompt
 *    file run with read tools only. It is a model request, so the CLI renews
 *    its session to make it, and rewrites `auth.json`. It spends one short
 *    prompt, which is why it only runs when step 1 was not enough.
 *
 * ResetOwl never reads the refresh credential and never writes the file. One
 * renewal runs per Grok home at a time: two CLIs renewing one login race.
 */

export const GROK_ACP_ARGS = [
  '--permission-mode',
  'default',
  'agent',
  '--no-leader',
  'stdio',
] as const;

/** Orca's headless task flags: read tools only, nothing that edits or runs. */
export function grokHeadlessArgs(sessionId: string, promptFile: string): string[] {
  return [
    '--session-id',
    sessionId,
    '--tools',
    'Read,Grep,Glob',
    '--disallowed-tools',
    'search_tool,use_tool,Agent',
    '--deny',
    'Bash,Edit,Write',
    '--permission-mode',
    'default',
    '--output-format',
    'plain',
    '--prompt-file',
    promptFile,
  ];
}

/** Orca's `GROK_TEXT_TASK_ENV`: the task keeps its session on this machine. */
export const GROK_TASK_ENV = { GROK_STORAGE_MODE: 'local' } as const;

export const GROK_RENEW_PROMPT = 'Reply with the single word: ok';

/** The sign-in method that reads `auth.json` and never prompts. */
export const GROK_CACHED_TOKEN = 'cached_token';

export const ACP_TIMEOUT_MS = 30_000;
export const TASK_TIMEOUT_MS = 120_000;
/** How long a CLI has to exit after SIGTERM before SIGKILL, and after SIGKILL. */
export const TERM_GRACE_MS = 5_000;
export const KILL_GRACE_MS = 2_000;

export type GrokRenewal =
  /** `auth.json` now holds a fresh session. */
  | { kind: 'renewed'; auth: GrokAuth }
  /** The CLI has no saved login to renew: sign in again. */
  | { kind: 'signed_out' }
  /** The CLI is not installed or may not run here. */
  | { kind: 'unavailable'; message: string }
  | { kind: 'failed'; message: string };

type AcpOutcome =
  | { kind: 'authenticated' }
  | { kind: 'signed_out' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'failed'; message: string };

export interface RenewTimeouts {
  acpMs: number;
  taskMs: number;
  termGraceMs: number;
  killGraceMs: number;
}

const DEFAULT_TIMEOUTS: RenewTimeouts = {
  acpMs: ACP_TIMEOUT_MS,
  taskMs: TASK_TIMEOUT_MS,
  termGraceMs: TERM_GRACE_MS,
  killGraceMs: KILL_GRACE_MS,
};

/**
 * Whether `cached_token` is the login the CLI would use on its own
 * (`_meta.defaultAuthMethodId`, else `cached_token` when offered), as Orca's
 * `grokTextTaskPreservesAccount` checks: authenticating with any other would
 * renew a different account than the one in `auth.json`.
 */
export function cachedTokenIsDefault(initialized: JsonRecord): boolean {
  const methods = Array.isArray(initialized.authMethods)
    ? initialized.authMethods
        .map((method) => (isRecord(method) ? method.id : null))
        .filter((id): id is string => typeof id === 'string')
    : [];
  const meta = isRecord(initialized._meta) ? initialized._meta : {};
  const declared = meta.defaultAuthMethodId;
  const selected =
    typeof declared === 'string' && methods.includes(declared)
      ? declared
      : methods.includes(GROK_CACHED_TOKEN)
        ? GROK_CACHED_TOKEN
        : methods[0];
  return selected === GROK_CACHED_TOKEN;
}

function offersCachedToken(initialized: JsonRecord): boolean {
  return (
    Array.isArray(initialized.authMethods) &&
    initialized.authMethods.some((m) => isRecord(m) && m.id === GROK_CACHED_TOKEN)
  );
}

/**
 * Stops a child and resolves once it has exited (SIGTERM, then SIGKILL if it
 * lingers), so the home's lock never passes on while a CLI may still be
 * rewriting `auth.json`.
 */
function stopper(child: CliChild, limits: RenewTimeouts) {
  let exited = false;
  let onExit: (() => void) | null = null;
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
  return {
    markExited() {
      exited = true;
      onExit?.();
    },
    async stop() {
      if (!exited) {
        signal('SIGTERM');
        await exitWithin(limits.termGraceMs);
      }
      if (!exited) {
        signal('SIGKILL');
        await exitWithin(limits.killGraceMs);
      }
    },
  };
}

function rpcMessage(id: number, method: string, params: unknown): string {
  return `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
}

/**
 * The ACP exchange over one spawned `grok agent stdio`: `initialize`, then
 * `authenticate` with `cached_token`. Never throws, and resolves only once
 * the process has exited.
 */
export function exchangeGrokAuthenticate(
  child: CliChild,
  timeouts: Partial<RenewTimeouts> = {},
): Promise<AcpOutcome> {
  const limits = { ...DEFAULT_TIMEOUTS, ...timeouts };
  return new Promise((resolve) => {
    const proc = stopper(child, limits);
    let buffer = '';
    let settled = false;
    const initId = 1;
    const authId = 2;
    const settle = (outcome: AcpOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void proc.stop().then(() => resolve(outcome));
    };
    const timer = setTimeout(
      () => settle({ kind: 'failed', message: 'Grok did not answer (ACP timeout).' }),
      limits.acpMs,
    );
    child.stdin?.on('error', () => undefined);
    child.stderr?.on('data', () => undefined);
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') proc.markExited();
      settle(
        err.code === 'ENOENT'
          ? { kind: 'unavailable', message: '`grok` is not installed or not on your PATH.' }
          : { kind: 'failed', message: err.message },
      );
    });
    child.on('close', (code) => {
      proc.markExited();
      settle({ kind: 'failed', message: `Grok exited before signing in (exit code ${code}).` });
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
        if (message.id === undefined) continue;
        if (message.method !== undefined) {
          // A request from the agent (a permission, a file read): refused, as Orca's task does.
          child.stdin?.write(
            `${JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Not supported' } })}\n`,
          );
          continue;
        }
        if (message.id === initId) {
          const result = isRecord(message.result) ? message.result : null;
          if (!result) {
            settle({ kind: 'failed', message: 'Grok could not start its agent server.' });
            return;
          }
          if (!offersCachedToken(result)) {
            settle({ kind: 'signed_out' });
            return;
          }
          if (!cachedTokenIsDefault(result)) {
            settle({
              kind: 'failed',
              message: 'Grok would sign in with another login than auth.json; not renewing it.',
            });
            return;
          }
          child.stdin?.write(rpcMessage(authId, 'authenticate', { methodId: GROK_CACHED_TOKEN }));
          continue;
        }
        if (message.id !== authId) continue;
        if (message.error !== undefined) {
          const error = isRecord(message.error) ? message.error.message : null;
          settle({
            kind: 'failed',
            message: `Grok could not sign in: ${typeof error === 'string' ? error : 'unknown error'}.`,
          });
          return;
        }
        settle({ kind: 'authenticated' });
      }
    });
    child.stdin?.write(
      rpcMessage(initId, 'initialize', {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        clientInfo: { name: 'resetowl', version: '1.0.0' },
      }),
    );
  });
}

/** Waits for the headless task to exit; never throws. */
export function awaitGrokTask(
  child: CliChild,
  timeouts: Partial<RenewTimeouts> = {},
): Promise<{ ok: true } | { ok: false; message: string }> {
  const limits = { ...DEFAULT_TIMEOUTS, ...timeouts };
  return new Promise((resolve) => {
    const proc = stopper(child, limits);
    let settled = false;
    const settle = (result: { ok: true } | { ok: false; message: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void proc.stop().then(() => resolve(result));
    };
    const timer = setTimeout(
      () => settle({ ok: false, message: 'Grok did not finish its renewal prompt.' }),
      limits.taskMs,
    );
    child.stdout?.on('data', () => undefined);
    child.stderr?.on('data', () => undefined);
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') proc.markExited();
      settle({ ok: false, message: err.message });
    });
    child.on('close', (code) => {
      proc.markExited();
      settle(code === 0 ? { ok: true } : { ok: false, message: `Grok exited with code ${code}.` });
    });
  });
}

const lockTails = new Map<string, Promise<unknown>>();

function withGrokHomeLock<T>(home: string, fn: () => Promise<T>): Promise<T> {
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

async function freshAuth(home: string, now: Date): Promise<GrokAuth | null> {
  const auth = await readGrokAuth(home, now).catch(() => null);
  return auth && isGrokSessionFresh(auth, now) ? auth : null;
}

/**
 * Lets Grok Build renew the lapsed session in `home`. `unavailable` where no
 * CLI may run (`env.spawnCli` absent); never throws.
 */
export function renewGrokSession(
  home: string,
  env: ProviderEnv,
  timeouts: Partial<RenewTimeouts> = {},
): Promise<GrokRenewal> {
  const spawnCli = env.spawnCli;
  if (!spawnCli) {
    return Promise.resolve({ kind: 'unavailable', message: 'No Grok CLI here.' });
  }
  const cliEnv = { GROK_HOME: home, ...GROK_TASK_ENV };
  return withGrokHomeLock(home, async (): Promise<GrokRenewal> => {
    // Another read may have renewed it while this one waited for the lock.
    const already = await freshAuth(home, env.now());
    if (already) return { kind: 'renewed', auth: already };

    let acp: CliChild;
    try {
      acp = spawnCli('grok', GROK_ACP_ARGS, cliEnv);
    } catch (err) {
      return { kind: 'unavailable', message: err instanceof Error ? err.message : String(err) };
    }
    const signedIn = await exchangeGrokAuthenticate(acp, timeouts);
    if (signedIn.kind !== 'authenticated') return signedIn;
    const afterAcp = await freshAuth(home, env.now());
    if (afterAcp) return { kind: 'renewed', auth: afterAcp };

    const dir = await mkdtemp(join(tmpdir(), 'resetowl-grok-'));
    try {
      const promptFile = join(dir, 'text-task-prompt.txt');
      await writeFile(promptFile, GROK_RENEW_PROMPT);
      let task: CliChild;
      try {
        task = spawnCli('grok', grokHeadlessArgs(randomUUID(), promptFile), cliEnv);
      } catch (err) {
        return { kind: 'unavailable', message: err instanceof Error ? err.message : String(err) };
      }
      const ran = await awaitGrokTask(task, timeouts);
      if (!ran.ok) return { kind: 'failed', message: ran.message };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    const afterTask = await freshAuth(home, env.now());
    return afterTask
      ? { kind: 'renewed', auth: afterTask }
      : { kind: 'failed', message: 'Grok ran but its session is still expired.' };
  });
}

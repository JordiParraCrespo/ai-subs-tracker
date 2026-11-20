import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CliChild, ProviderEnv } from '../types';

export const NOW = new Date('2026-11-02T12:00:00Z');
export const SINCE = '2026-10-01';

export async function tempHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'resetowl-providers-'));
}

export async function writeText(path: string, text: string, mtime?: Date): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  if (mtime) await utimes(path, mtime, mtime);
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeText(path, JSON.stringify(data));
}

export const jsonl = (...records: unknown[]) => records.map((r) => JSON.stringify(r)).join('\n');

export interface FetchCall {
  url: string;
  headers: Record<string, string>;
}

/** A fetch that answers `body` with `status` and records each call. */
export function fakeFetch(body: unknown, status = 200) {
  const calls: FetchCall[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { fn, calls };
}

export const failingFetch = (message: string) =>
  (async () => {
    throw new Error(message);
  }) as typeof fetch;

export function testEnv(home: string, overrides: Partial<ProviderEnv> = {}): ProviderEnv {
  return {
    home,
    platform: 'linux',
    env: {},
    now: () => NOW,
    fetch: failingFetch('network disabled in tests'),
    userAgent: 'resetowl-desktop/test',
    managedRoot: join(home, 'managed'),
    readKeychain: async () => null,
    ...overrides,
  };
}

/** A JWT with `payload`, unsigned (the providers never verify one). */
export function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

export function claudeAssistantLine(opts: {
  ts: string;
  model?: string;
  id?: string;
  requestId?: string;
  input?: number;
  output?: number;
  cacheWrite?: number;
  cacheRead?: number;
}): Record<string, unknown> {
  return {
    type: 'assistant',
    timestamp: opts.ts,
    requestId: opts.requestId,
    message: {
      id: opts.id,
      model: opts.model ?? 'claude-sonnet-4-5',
      usage: {
        input_tokens: opts.input ?? 0,
        output_tokens: opts.output ?? 0,
        cache_creation_input_tokens: opts.cacheWrite ?? 0,
        cache_read_input_tokens: opts.cacheRead ?? 0,
      },
    },
  };
}

/** What a fake `codex app-server` does when asked `account/rateLimits/read`. */
export type FakeAppServer =
  | { result: unknown }
  | { error: string; stderr?: string }
  | { exit: number; stderr?: string }
  | { enoent: true };

export interface SpawnCall {
  command: string;
  args: readonly string[];
  env: Record<string, string>;
}

/**
 * A `spawnCli` whose child speaks the app-server's JSON-RPC: it answers
 * `initialize`, then `account/rateLimits/read` as `behaviour` says.
 */
export function fakeAppServer(
  behaviour: FakeAppServer,
  /** Runs while the probe answers, as the real CLI may rewrite `auth.json`. */
  onRead?: () => Promise<void>,
) {
  const calls: SpawnCall[] = [];
  const spawnCli: NonNullable<ProviderEnv['spawnCli']> = (command, args, env) => {
    calls.push({ command, args, env });
    const child = new EventEmitter() as EventEmitter & CliChild;
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    let closed = false;
    const say = (message: unknown) =>
      queueMicrotask(() => stdout.emit('data', Buffer.from(`${JSON.stringify(message)}\n`)));
    const close = (code: number | null, signal: NodeJS.Signals | null = null) =>
      queueMicrotask(() => {
        if (closed) return;
        closed = true;
        child.emit('close', code, signal);
      });
    Object.assign(child, {
      stdout,
      stderr,
      // Exits when told to, as the real CLI does.
      kill: (signal: NodeJS.Signals = 'SIGTERM') => {
        close(null, signal);
        return true;
      },
      stdin: {
        on: () => undefined,
        write(data: string) {
          for (const line of data.split('\n').filter(Boolean)) {
            const msg = JSON.parse(line) as { id?: number; method: string };
            if (msg.method === 'initialize') say({ id: msg.id, result: {} });
            if (msg.method !== 'account/rateLimits/read') continue;
            if ('result' in behaviour) {
              const id = msg.id;
              void (onRead?.() ?? Promise.resolve()).then(() =>
                say({ id, result: behaviour.result }),
              );
            }
            if ('error' in behaviour) {
              if (behaviour.stderr) stderr.emit('data', Buffer.from(behaviour.stderr));
              say({ id: msg.id, error: { code: -1, message: behaviour.error } });
            }
            if ('exit' in behaviour) {
              if (behaviour.stderr) stderr.emit('data', Buffer.from(behaviour.stderr));
              close(behaviour.exit);
            }
          }
          return true;
        },
      },
    });
    if ('enoent' in behaviour) {
      queueMicrotask(() =>
        child.emit('error', Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' })),
      );
    }
    return child;
  };
  return { spawnCli, calls };
}

/** What a fake `grok` does when ResetOwl starts it to renew a session. */
export interface FakeGrok {
  /** The sign-in methods `initialize` offers; `cached_token` means a saved login. */
  authMethods?: string[];
  /** `_meta.defaultAuthMethodId` in the `initialize` answer. */
  defaultAuthMethodId?: string | null;
  /** Runs when `authenticate` is asked, as the real CLI may rewrite `auth.json`. */
  onAuthenticate?: () => Promise<void>;
  /** Runs during the headless prompt; its exit code is `taskExit` (0 by default). */
  onTask?: (promptFile: string) => Promise<void>;
  taskExit?: number;
  enoent?: boolean;
}

/**
 * A `spawnCli` that plays Grok Build: `grok agent stdio` speaks ACP
 * (`initialize`, `authenticate`), any other invocation is the headless task.
 */
export function fakeGrok(behaviour: FakeGrok = {}) {
  const calls: SpawnCall[] = [];
  const rpc: { method: string; params: unknown }[] = [];
  const spawnCli: NonNullable<ProviderEnv['spawnCli']> = (command, args, env) => {
    calls.push({ command, args, env });
    const child = new EventEmitter() as EventEmitter & CliChild;
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    let closed = false;
    const close = (code: number | null, signal: NodeJS.Signals | null = null) =>
      queueMicrotask(() => {
        if (closed) return;
        closed = true;
        child.emit('close', code, signal);
      });
    const say = (message: unknown) =>
      queueMicrotask(() => stdout.emit('data', Buffer.from(`${JSON.stringify(message)}\n`)));
    Object.assign(child, {
      stdout,
      stderr,
      kill: (signal: NodeJS.Signals = 'SIGTERM') => {
        close(null, signal);
        return true;
      },
      stdin: {
        on: () => undefined,
        write(data: string) {
          for (const line of data.split('\n').filter(Boolean)) {
            const msg = JSON.parse(line) as { id?: number; method?: string; params?: unknown };
            if (!msg.method) continue;
            rpc.push({ method: msg.method, params: msg.params });
            if (msg.method === 'initialize') {
              const methods = behaviour.authMethods ?? ['cached_token', 'grok.com'];
              say({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  protocolVersion: 1,
                  authMethods: methods.map((id) => ({ id, name: id })),
                  _meta: {
                    defaultAuthMethodId:
                      behaviour.defaultAuthMethodId === undefined
                        ? methods.includes('cached_token')
                          ? 'cached_token'
                          : null
                        : behaviour.defaultAuthMethodId,
                  },
                },
              });
            }
            if (msg.method === 'authenticate') {
              const id = msg.id;
              void (behaviour.onAuthenticate?.() ?? Promise.resolve()).then(() =>
                say({ jsonrpc: '2.0', id, result: {} }),
              );
            }
          }
          return true;
        },
      },
    });
    if (behaviour.enoent) {
      queueMicrotask(() =>
        child.emit('error', Object.assign(new Error('spawn grok ENOENT'), { code: 'ENOENT' })),
      );
    } else if (!args.includes('agent')) {
      const promptFile = args[args.indexOf('--prompt-file') + 1] ?? '';
      void (behaviour.onTask?.(promptFile) ?? Promise.resolve()).then(() =>
        close(behaviour.taskExit ?? 0),
      );
    }
    return child;
  };
  return { spawnCli, calls, rpc };
}

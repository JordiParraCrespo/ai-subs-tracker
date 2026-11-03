import { mkdir, mkdtemp, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProviderEnv } from '../types';

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

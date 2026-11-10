import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProviderEnv } from '../types';

export { claudeAssistantLine, fakeJwt, jsonl, writeJson, writeText } from '../testing';

export const NOW = new Date('2026-11-02T12:00:00Z');
export const SINCE = '2026-10-01';

export async function tempHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'resetowl-providers-'));
}

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

import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Env } from "../src/types.js";

export const NOW = new Date("2026-11-02T12:00:00Z");

export async function tempHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), "aisubs-test-"));
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof data === "string" ? data : JSON.stringify(data));
}

export interface FakeFetchCall {
  url: string;
  headers: Record<string, string>;
}

/** A fetch that answers with `body`/`status` and records what it was called with. */
export function fakeFetch(body: unknown, status = 200) {
  const calls: FakeFetchCall[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { fn, calls };
}

export function testEnv(home: string, overrides: Partial<Env> = {}): Env {
  return {
    now: () => NOW,
    home,
    platform: "linux",
    fetch: fakeFetch({}).fn,
    exec: async () => null,
    ...overrides,
  };
}

export function assistantLine(opts: {
  ts: string;
  model?: string;
  id?: string;
  requestId?: string;
  input?: number;
  output?: number;
  cacheCreation?: number;
  cacheRead?: number;
}): string {
  return JSON.stringify({
    type: "assistant",
    timestamp: opts.ts,
    requestId: opts.requestId,
    message: {
      id: opts.id,
      model: opts.model ?? "claude-sonnet-4-5",
      usage: {
        input_tokens: opts.input ?? 0,
        output_tokens: opts.output ?? 0,
        cache_creation_input_tokens: opts.cacheCreation ?? 0,
        cache_read_input_tokens: opts.cacheRead ?? 0,
      },
    },
  });
}

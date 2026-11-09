import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Writes `text` at `path`, creating its folders; `mtime` dates the file. */
export async function writeText(path: string, text: string, mtime?: Date): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  if (mtime) await utimes(path, mtime, mtime);
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeText(path, JSON.stringify(data));
}

/** Records as the lines of a JSONL file. */
export const jsonl = (...records: unknown[]) => records.map((r) => JSON.stringify(r)).join('\n');

/** A JWT with `payload`, unsigned (the providers never verify one). */
export function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

/** One assistant turn as Claude Code writes it to a transcript. */
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

/**
 * A Codex session as it lands in `sessions/YYYY/MM/DD/rollout-*.jsonl`: the
 * meta line, the model, and one `token_count` with the running total.
 */
export function codexSessionLines(opts: {
  ts: string;
  sessionId: string;
  model?: string;
  input?: number;
  cachedInput?: number;
  output?: number;
}): unknown[] {
  const usage = {
    input_tokens: opts.input ?? 0,
    cached_input_tokens: opts.cachedInput ?? 0,
    output_tokens: opts.output ?? 0,
    reasoning_output_tokens: 0,
    total_tokens: (opts.input ?? 0) + (opts.output ?? 0),
  };
  return [
    { timestamp: opts.ts, type: 'session_meta', payload: { id: opts.sessionId, cwd: '/w' } },
    { timestamp: opts.ts, type: 'turn_context', payload: { model: opts.model ?? 'gpt-5-codex' } },
    {
      timestamp: opts.ts,
      type: 'event_msg',
      payload: { type: 'token_count', info: { total_token_usage: usage, last_token_usage: usage } },
    },
  ];
}

import { join } from 'node:path';
import type { DailyTokens, LimitWindow } from '@flama/shared/schemas/accounts';
import {
  DailyTokenBuckets,
  forEachLine,
  isoOrNull,
  isRecord,
  type JsonlFile,
  type JsonRecord,
  listJsonlFiles,
  localDayStart,
  num,
  parseJsonLine,
  str,
  toIso,
} from '../lib/util';
import { codexWindow, sortCodexWindows } from './usage-api';

/**
 * Codex records each session as JSONL under `<CODEX_HOME>/sessions/YYYY/MM/DD/`.
 * Lines are `{ timestamp, type, payload }`; `turn_context` names the model,
 * and `event_msg` lines whose `payload.type` is `token_count` carry
 * `info.{last_token_usage,total_token_usage}` and the `rate_limits` the
 * server last reported.
 */

interface RawUsage {
  input: number;
  cached: number;
  output: number;
  reasoning: number;
  total: number;
}

export interface SessionRateLimits {
  /** When the session recorded them, ISO. */
  observedAt: string;
  planType: string | null;
  windows: LimitWindow[];
}

export interface CodexSessionScan {
  dailyTokens: DailyTokens[];
  rateLimits: SessionRateLimits | null;
}

/** How many of the newest files to search for limits when none fall in the token range. */
const RATE_LIMIT_FILE_BUDGET = 20;

function rawUsage(value: unknown): RawUsage | null {
  if (!isRecord(value)) return null;
  const input = Math.max(0, num(value.input_tokens) ?? 0);
  const output = Math.max(0, num(value.output_tokens) ?? 0);
  const total = Math.max(0, num(value.total_tokens) ?? 0);
  return {
    input,
    cached: Math.max(0, num(value.cached_input_tokens ?? value.cache_read_input_tokens) ?? 0),
    output,
    reasoning: Math.max(0, num(value.reasoning_output_tokens) ?? 0),
    total: total > 0 ? total : input + output,
  };
}

const tuple = (u: RawUsage | null) =>
  u ? [u.input, u.cached, u.output, u.reasoning, u.total].join(',') : '';

const sameUsage = (a: RawUsage, b: RawUsage) => tuple(a) === tuple(b);

const monotonic = (current: RawUsage, previous: RawUsage) =>
  current.input >= previous.input &&
  current.cached >= previous.cached &&
  current.output >= previous.output &&
  current.reasoning >= previous.reasoning;

function subtract(current: RawUsage, previous: RawUsage): RawUsage {
  return {
    input: current.input - previous.input,
    cached: current.cached - previous.cached,
    output: current.output - previous.output,
    reasoning: current.reasoning - previous.reasoning,
    total: Math.max(0, current.total - previous.total),
  };
}

function modelOf(payload: JsonRecord): string | null {
  const info = isRecord(payload.info) ? payload.info : null;
  return str(payload.model) ?? str(payload.model_name) ?? str(info?.model) ?? null;
}

function sessionWindow(key: string, value: unknown, observed: Date): LimitWindow | null {
  if (!isRecord(value)) return null;
  const minutes = num(value.window_minutes);
  const relative = num(value.resets_in_seconds ?? value.resets_after_seconds);
  return codexWindow(key, {
    usedPercent: value.used_percent,
    minutes: minutes !== null && minutes > 0 ? Math.round(minutes) : null,
    resetsAt:
      toIso(value.resets_at) ??
      (relative === null ? null : isoOrNull(new Date(observed.getTime() + relative * 1000))),
  });
}

/** The `rate_limits` of one `token_count` payload, or null when it has none. */
export function parseSessionRateLimits(
  payload: JsonRecord,
  observed: Date,
): SessionRateLimits | null {
  const limits = payload.rate_limits;
  if (!isRecord(limits)) return null;
  const windows = [
    sessionWindow('primary', limits.primary, observed),
    sessionWindow('secondary', limits.secondary, observed),
  ].filter((w): w is LimitWindow => w !== null);
  if (windows.length === 0) return null;
  return {
    observedAt: observed.toISOString(),
    planType: str(limits.plan_type),
    windows: sortCodexWindows(windows),
  };
}

interface FileState {
  model: string | null;
  previousTotals: RawUsage | null;
}

/**
 * Reads one session file: token deltas go to `onTokens`, and the newest
 * rate-limit report it holds is returned.
 */
async function scanFile(
  path: string,
  onTokens: ((at: Date, model: string, usage: RawUsage, key: string) => void) | null,
): Promise<SessionRateLimits | null> {
  const state: FileState = { model: null, previousTotals: null };
  let latest: SessionRateLimits | null = null;
  await forEachLine(path, (line) => {
    const record = parseJsonLine(line);
    if (!record || !isRecord(record.payload)) return;
    const payload = record.payload;
    if (record.type === 'session_meta' || record.type === 'turn_context') {
      state.model = modelOf(payload) ?? state.model;
      return;
    }
    if (record.type !== 'event_msg' || payload.type !== 'token_count') return;
    const ts = str(record.timestamp);
    const at = ts ? new Date(ts) : null;
    if (!at || isoOrNull(at) === null) return;

    const limits = parseSessionRateLimits(payload, at);
    if (limits && (!latest || limits.observedAt >= latest.observedAt)) latest = limits;

    if (!onTokens || !isRecord(payload.info)) return;
    const total = rawUsage(payload.info.total_token_usage);
    const last = rawUsage(payload.info.last_token_usage);
    let delta: RawUsage | null = null;
    if (last) {
      // A repeated report of the same totals is not a new request.
      if (total && state.previousTotals && sameUsage(total, state.previousTotals)) return;
      delta = last;
      if (total) state.previousTotals = total;
    } else if (total) {
      const previous = state.previousTotals;
      state.previousTotals = total;
      if (!previous) delta = total;
      else if (sameUsage(total, previous) || !monotonic(total, previous)) return;
      else delta = subtract(total, previous);
    }
    if (!delta || delta.input + delta.output + delta.cached + delta.reasoning === 0) return;
    const model = modelOf(payload) ?? state.model ?? 'unknown';
    // Forked sessions copy usage lines; the timestamp and counts identify one event.
    onTokens(at, model, delta, `${ts}|${tuple(total)}|${tuple(last)}`);
  });
  return latest;
}

function newer(a: SessionRateLimits | null, b: SessionRateLimits | null) {
  if (!a) return b;
  if (!b) return a;
  return b.observedAt > a.observedAt ? b : a;
}

/** Tokens per local day and model from `sinceDay` on, and the newest limits any session saw. */
export async function scanCodexSessions(home: string, sinceDay: string): Promise<CodexSessionScan> {
  const since = localDayStart(sinceDay);
  const files: JsonlFile[] = (await listJsonlFiles(join(home, 'sessions'))).sort(
    (a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path),
  );
  const recent = files.filter((file) => file.mtimeMs >= since);
  const buckets = new DailyTokenBuckets(sinceDay);
  const seen = new Set<string>();
  let rateLimits: SessionRateLimits | null = null;

  for (const file of recent) {
    const found = await scanFile(file.path, (at, model, usage, key) => {
      if (seen.has(key)) return;
      seen.add(key);
      const cacheRead = Math.min(usage.cached, usage.input);
      buckets.add(at, model, {
        // Codex counts cached tokens inside input_tokens.
        input: usage.input - cacheRead,
        // Reasoning tokens are already part of output_tokens.
        output: usage.output,
        cacheWrite: 0,
        cacheRead,
      });
    });
    rateLimits = newer(rateLimits, found);
  }

  if (!rateLimits) {
    for (const file of files.filter((f) => f.mtimeMs < since).slice(0, RATE_LIMIT_FILE_BUDGET)) {
      rateLimits = newer(rateLimits, await scanFile(file.path, null));
      if (rateLimits) break;
    }
  }

  return { dailyTokens: buckets.toArray(), rateLimits };
}

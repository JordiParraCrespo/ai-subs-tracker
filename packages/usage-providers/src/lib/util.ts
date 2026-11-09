import { createHash } from 'node:crypto';
import { createReadStream, type Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type {
  DailyTokens,
  LimitWindow,
  SnapshotStatus,
  UsageSnapshot,
} from '@flama/shared/schemas/accounts';

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export async function readJson(path: string): Promise<JsonRecord | null> {
  try {
    const data: unknown = JSON.parse(await readFile(path, 'utf8'));
    return isRecord(data) ? data : null;
  } catch {
    return null;
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Subdirectories of `dir`, absolute and sorted; empty when it cannot be read. */
export async function subdirectories(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name))
      .sort();
  } catch {
    return [];
  }
}

export interface JsonlFile {
  path: string;
  mtimeMs: number;
}

/** Every `*.jsonl` under `dir`, recursively, with its modification time. */
export async function listJsonlFiles(dir: string): Promise<JsonlFile[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: JsonlFile[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const file of await listJsonlFiles(full)) out.push(file);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      try {
        out.push({ path: full, mtimeMs: (await stat(full)).mtimeMs });
      } catch {
        // vanished between readdir and stat
      }
    }
  }
  return out;
}

/** Calls `onLine` for each line; an unreadable file is skipped, not fatal. */
export async function forEachLine(path: string, onLine: (line: string) => void): Promise<void> {
  try {
    const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
    for await (const line of rl) onLine(line);
  } catch {
    // unreadable — skip it rather than failing the whole account
  }
}

export function parseJsonLine(line: string): JsonRecord | null {
  try {
    const data: unknown = JSON.parse(line);
    return isRecord(data) ? data : null;
  } catch {
    return null;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of `date` in the machine's local time zone. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight that starts `day` (`YYYY-MM-DD`), as epoch milliseconds. */
export function localDayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
}

/**
 * The years a timestamp may fall in. The contract's dates are ISO with a
 * four-digit year, and a `Date` reaches year 275760; nothing a vendor or a
 * transcript dates outside this range is a real time.
 */
const MIN_INSTANT_MS = Date.UTC(1970, 0, 1);
const MAX_INSTANT_MS = Date.UTC(9999, 0, 1);

/** `date` as ISO; null when it is not a time, or not one the contract can carry. */
export function isoOrNull(date: Date): string | null {
  const ms = date.getTime();
  if (!Number.isFinite(ms) || ms < MIN_INSTANT_MS || ms > MAX_INSTANT_MS) return null;
  return date.toISOString();
}

/**
 * A timestamp as ISO, from an ISO string or an epoch number. Epoch values
 * below 1e12 are seconds, above are milliseconds.
 */
export function toIso(value: unknown): string | null {
  const n = num(value);
  if (n !== null) return isoOrNull(new Date(n < 1e12 ? n * 1000 : n));
  if (typeof value !== 'string') return null;
  return isoOrNull(new Date(value));
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Provider account id when known; else `email:<email>`; else `home:<hash of home>`. */
export function externalIdFor(
  accountId: string | null,
  email: string | null,
  home: string,
): string {
  if (accountId) return accountId.slice(0, 200);
  if (email) return `email:${email.toLowerCase()}`.slice(0, 200);
  return `home:${sha256Hex(home).slice(0, 16)}`;
}

/** Utilisation clamped to the contract's 0–1000 range. */
export function percent(value: unknown): number | null {
  const n = num(value);
  if (n === null) return null;
  return Math.min(Math.max(n, 0), 1000);
}

export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Ten years of minutes: no plan meters a longer window, and a larger number is a vendor's mistake. */
const MAX_WINDOW_MINUTES = 10 * 366 * 24 * 60;

/**
 * A window as the contract accepts it. The vendors' answers are undocumented,
 * so a parser may hand over an empty key, a reset in year 275760 or a window
 * of 1e308 minutes; one such window makes the API refuse the whole sync, for
 * every account on the machine. What cannot be carried becomes null (or, for
 * a name, a placeholder) and the rest of the window is kept.
 */
export function fitWindow(window: LimitWindow): LimitWindow {
  const key = window.key.trim().slice(0, 80) || 'limit';
  const minutes = window.windowMinutes;
  const reset = window.resetsAt === null ? null : isoOrNull(new Date(window.resetsAt));
  return {
    key,
    kind: window.kind,
    label: window.label.trim().slice(0, 80) || key,
    utilization: percent(window.utilization),
    resetsAt: reset,
    windowMinutes:
      minutes !== null && Number.isFinite(minutes) && minutes >= 0.5
        ? Math.round(minutes) <= MAX_WINDOW_MINUTES
          ? Math.round(minutes)
          : null
        : null,
  };
}

export function snapshot(
  now: Date,
  status: SnapshotStatus,
  message: string | null,
  windows: LimitWindow[] = [],
  extraUsage: UsageSnapshot['extraUsage'] = null,
  capturedAt: string = now.toISOString(),
): UsageSnapshot {
  return {
    capturedAt,
    source: 'poll',
    status,
    message: message === null ? null : clip(message, 500),
    windows: windows.slice(0, 20).map(fitWindow),
    extraUsage,
  };
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'The request timed out.';
    return err.message;
  }
  return String(err);
}

/** A running token count: whole, never negative, never past what an integer holds exactly. */
function addTokens(total: number, more: number): number {
  const add = Number.isFinite(more) ? Math.max(0, Math.round(more)) : 0;
  return Math.min(total + add, Number.MAX_SAFE_INTEGER);
}

/** Collects tokens into one row per local day and model. */
export class DailyTokenBuckets {
  private readonly rows = new Map<string, DailyTokens>();

  constructor(private readonly sinceDay: string) {}

  add(
    timestamp: Date,
    model: string,
    tokens: { input: number; output: number; cacheWrite: number; cacheRead: number },
  ): void {
    // A transcript dated outside the contract's years is not a day anyone used tokens on.
    if (isoOrNull(timestamp) === null) return;
    const day = localDay(timestamp);
    if (day < this.sinceDay) return;
    const name = clip(model, 120);
    const key = `${day}\u0000${name}`;
    let row = this.rows.get(key);
    if (!row) {
      row = { day, model: name, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, messages: 0 };
      this.rows.set(key, row);
    }
    row.input = addTokens(row.input, tokens.input);
    row.output = addTokens(row.output, tokens.output);
    row.cacheWrite = addTokens(row.cacheWrite, tokens.cacheWrite);
    row.cacheRead = addTokens(row.cacheRead, tokens.cacheRead);
    row.messages += 1;
  }

  /** Sorted by day then model; the newest 1000 rows when there are more. */
  toArray(): DailyTokens[] {
    const all = [...this.rows.values()].sort(
      (a, b) => a.day.localeCompare(b.day) || a.model.localeCompare(b.model),
    );
    return all.slice(-1000);
  }
}

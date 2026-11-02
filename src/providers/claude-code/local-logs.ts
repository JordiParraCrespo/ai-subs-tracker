import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { LocalActivity, TokenTotals } from "../../types.js";

/**
 * Claude Code writes every conversation as JSONL under `<configDir>/projects/`.
 * Assistant messages carry a `usage` block with token counts, which lets us
 * show activity per account even without network access.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_WINDOW_MS = 5 * 60 * 60 * 1000;

export interface UsageEntry {
  timestamp: Date;
  model: string;
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  /** message id + request id, used to drop duplicates across resumed sessions. */
  dedupeKey?: string;
}

export function emptyTotals(): TokenTotals {
  return { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0, messages: 0 };
}

function add(t: TokenTotals, e: UsageEntry): void {
  t.input += e.input;
  t.output += e.output;
  t.cacheCreation += e.cacheCreation;
  t.cacheRead += e.cacheRead;
  t.total += e.input + e.output + e.cacheCreation + e.cacheRead;
  t.messages += 1;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Parse one JSONL line; returns null for anything that isn't a usage record. */
export function parseLine(line: string): UsageEntry | null {
  if (!line.includes('"usage"')) return null; // cheap pre-filter
  let obj: Record<string, any>;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  const msg = obj?.message;
  const usage = msg?.usage;
  if (!usage || typeof obj.timestamp !== "string") return null;
  const model = typeof msg.model === "string" ? msg.model : "unknown";
  if (model === "<synthetic>") return null;
  const timestamp = new Date(obj.timestamp);
  if (Number.isNaN(timestamp.getTime())) return null;

  return {
    timestamp,
    model,
    input: n(usage.input_tokens),
    output: n(usage.output_tokens),
    cacheCreation: n(usage.cache_creation_input_tokens),
    cacheRead: n(usage.cache_read_input_tokens),
    dedupeKey:
      typeof msg.id === "string" && typeof obj.requestId === "string"
        ? `${msg.id}:${obj.requestId}`
        : undefined,
  };
}

export function aggregate(entries: Iterable<UsageEntry>, now: Date, sessionWindowStart: Date): LocalActivity {
  const weekStart = now.getTime() - 7 * DAY_MS;
  const session = emptyTotals();
  const last7Days = emptyTotals();
  const byModel: Record<string, TokenTotals> = {};
  const seen = new Set<string>();
  let last: number | null = null;

  for (const e of entries) {
    const t = e.timestamp.getTime();
    if (t < weekStart || t > now.getTime()) continue;
    if (e.dedupeKey) {
      if (seen.has(e.dedupeKey)) continue;
      seen.add(e.dedupeKey);
    }
    add(last7Days, e);
    add((byModel[e.model] ??= emptyTotals()), e);
    if (t >= sessionWindowStart.getTime()) add(session, e);
    if (last === null || t > last) last = t;
  }

  return {
    sessionWindowStart: sessionWindowStart.toISOString(),
    session,
    last7Days,
    byModel,
    lastActivityAt: last === null ? null : new Date(last).toISOString(),
  };
}

/** Recursively list *.jsonl files modified at or after `since`. */
async function recentJsonlFiles(dir: string, since: number): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  await Promise.all(
    entries.map(async (ent) => {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        out.push(...(await recentJsonlFiles(full, since)));
      } else if (ent.isFile() && ent.name.endsWith(".jsonl")) {
        try {
          if ((await stat(full)).mtimeMs >= since) out.push(full);
        } catch {
          // vanished between readdir and stat
        }
      }
    }),
  );
  return out;
}

async function* readEntries(file: string): AsyncGenerator<UsageEntry> {
  const rl = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    const e = parseLine(line);
    if (e) yield e;
  }
}

/** Returns null when this config dir has no transcript folder at all. */
export async function scanLocalActivity(
  configDir: string,
  now: Date,
  sessionWindowStart: Date,
): Promise<LocalActivity | null> {
  const projectsDir = join(configDir, "projects");
  try {
    if (!(await stat(projectsDir)).isDirectory()) return null;
  } catch {
    return null;
  }
  const files = await recentJsonlFiles(projectsDir, now.getTime() - 7 * DAY_MS);
  const entries: UsageEntry[] = [];
  for (const f of files) {
    try {
      for await (const e of readEntries(f)) entries.push(e);
    } catch {
      // unreadable file — skip it rather than failing the whole account
    }
  }
  return aggregate(entries, now, sessionWindowStart);
}

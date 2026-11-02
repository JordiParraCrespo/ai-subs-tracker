import { join } from 'node:path';
import type { DailyTokens } from '@flama/shared/schemas/accounts';
import {
  DailyTokenBuckets,
  forEachLine,
  isRecord,
  listJsonlFiles,
  localDayStart,
  num,
  parseJsonLine,
  str,
} from '../lib/util';

/**
 * Claude Code writes each conversation as JSONL under `<configDir>/projects/`.
 * Assistant messages carry `message.usage` token counts, so activity per
 * account is known without the network.
 */
export interface ClaudeUsageEntry {
  timestamp: Date;
  model: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  /** message id and request id: a resumed session repeats both. */
  dedupeKey: string | null;
}

const count = (value: unknown) => Math.max(0, num(value) ?? 0);

/** One JSONL line, or null for anything that is not a usage record. */
export function parseClaudeLogLine(line: string): ClaudeUsageEntry | null {
  if (!line.includes('"usage"')) return null; // cheap pre-filter
  const record = parseJsonLine(line);
  const message = record?.message;
  if (!record || !isRecord(message) || !isRecord(message.usage)) return null;
  if (record.type !== undefined && record.type !== 'assistant') return null;
  const model = str(message.model) ?? 'unknown';
  if (model === '<synthetic>') return null;
  const ts = str(record.timestamp);
  const timestamp = ts ? new Date(ts) : null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) return null;
  const usage = message.usage;
  const messageId = str(message.id);
  const requestId = str(record.requestId);
  return {
    timestamp,
    model,
    input: count(usage.input_tokens),
    output: count(usage.output_tokens),
    cacheWrite: count(usage.cache_creation_input_tokens),
    cacheRead: count(usage.cache_read_input_tokens),
    dedupeKey: messageId || requestId ? `${messageId ?? ''}:${requestId ?? ''}` : null,
  };
}

/** Tokens per local day and model from `sinceDay` on. */
export async function scanClaudeTokens(
  configDir: string,
  sinceDay: string,
): Promise<DailyTokens[]> {
  const since = localDayStart(sinceDay);
  const files = (await listJsonlFiles(join(configDir, 'projects')))
    .filter((file) => file.mtimeMs >= since)
    .sort((a, b) => a.path.localeCompare(b.path));
  const buckets = new DailyTokenBuckets(sinceDay);
  const seen = new Set<string>();
  for (const file of files) {
    await forEachLine(file.path, (line) => {
      const entry = parseClaudeLogLine(line);
      if (!entry) return;
      if (entry.dedupeKey) {
        if (seen.has(entry.dedupeKey)) return;
        seen.add(entry.dedupeKey);
      }
      buckets.add(entry.timestamp, entry.model, entry);
    });
  }
  return buckets.toArray();
}

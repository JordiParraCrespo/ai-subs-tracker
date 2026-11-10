import type {
  LimitWindow,
  SnapshotStatus,
  UsageSnapshot,
  WindowKind,
} from '@flama/shared/schemas/accounts';
import { type ManualProviderId, UNOFFICIAL_USAGE_READERS } from '@flama/shared/subscriptions';
import { errorMessage, isoOrNull, isRecord, num, percent, snapshot, str } from '../lib/util';
import type { ProviderEnv } from '../types';

/**
 * Reads a GLM Coding Plan's limits (Z.AI, or BigModel in mainland China) from
 * `GET <origin>/api/monitor/usage/quota/limit`, with the person's own plan
 * key. **The endpoint is not in either vendor's documentation**: Z.AI's own
 * `glm-plan-usage` plugin, Orca and ZCode call it, and this parser follows
 * what they read (Orca's `zcode-usage-fetcher.ts`), tolerantly. So it is
 * opt-in, and every reading is labelled `unofficial`.
 *
 * - The key goes only to the provider's origin from `UNOFFICIAL_USAGE_READERS`,
 *   over HTTPS, as the raw `Authorization` value (no `Bearer`, as those tools
 *   send it), with redirects refused so it cannot be forwarded elsewhere.
 * - Never in a message: a vendor's error text is scrubbed of it.
 * - Never throws: a failure is a status and a short message.
 */

export const QUOTA_PATH = '/api/monitor/usage/quota/limit';
const TIMEOUT_MS = 15_000;
const FIVE_HOURS = 300;
const WEEK = 7 * 24 * 60;
const MONTH = 30 * 24 * 60;

export interface QuotaRequest {
  provider: ManualProviderId;
  apiKey: string;
}

export interface QuotaReading {
  status: SnapshotStatus;
  /** For the person when it did not work; null when it did. */
  message: string | null;
  /** The tier the vendor names (`lite`, `pro`, `max`), when it does. */
  reportedPlan: string | null;
  /** The windows with their real resets; null unless `status` is `ok`. */
  snapshot: UsageSnapshot | null;
}

type QuotaEnv = Pick<ProviderEnv, 'fetch' | 'userAgent' | 'now'>;

/** Minutes per unit code, as the endpoint encodes a window's length (1 day, 3 hour, 5 minute, 6 week). */
const UNIT_MINUTES: Record<number, number> = { 1: 1440, 3: 60, 5: 1, 6: 10080 };

function windowMinutes(limit: Record<string, unknown>): number | null {
  // The monthly MCP allowance is encoded as "one minute".
  if (limit.type === 'TIME_LIMIT' && limit.unit === 5 && limit.number === 1) return MONTH;
  const unit = num(limit.unit);
  const count = num(limit.number);
  if (unit === null || count === null || !Number.isInteger(count) || count <= 0) return null;
  const minutes = UNIT_MINUTES[unit];
  return minutes ? minutes * count : null;
}

/** Percent used: from the counts when they are there (the percentage can lag), else as reported. */
function usedPercent(limit: Record<string, unknown>): number | null {
  const total = num(limit.usage);
  if (total !== null && total > 0) {
    const current = num(limit.currentValue);
    const remaining = num(limit.remaining);
    if (current !== null || remaining !== null) {
      const used = current ?? total - (remaining ?? 0);
      return Math.min(100, Math.max(0, (used / total) * 100));
    }
  }
  return percent(limit.percentage);
}

function describe(
  type: unknown,
  minutes: number,
): { key: string; kind: WindowKind; label: string } | null {
  if (type === 'TIME_LIMIT') {
    return minutes === MONTH ? { key: 'mcp_monthly', kind: 'monthly', label: 'MCP tools' } : null;
  }
  if (type !== 'TOKENS_LIMIT' && type !== 'CREDIT_LIMIT') return null;
  if (minutes === FIVE_HOURS) return { key: 'five_hour', kind: 'session', label: '5-hour' };
  if (minutes === WEEK) return { key: 'weekly', kind: 'weekly', label: 'Weekly' };
  return { key: `limit_${minutes}m`, kind: 'other', label: `${minutes}-minute limit` };
}

/** The windows in a quota answer; empty when there is nothing usable. */
export function parseZaiQuota(
  body: unknown,
  now: Date,
): { windows: LimitWindow[]; reportedPlan: string | null } | null {
  if (!isRecord(body) || body.success !== true) return null;
  if (body.code !== undefined && body.code !== 0 && body.code !== 200) return null;
  const data = isRecord(body.data) ? body.data : null;
  if (!data || !Array.isArray(data.limits)) return null;

  const windows: LimitWindow[] = [];
  const seen = new Set<string>();
  for (const limit of data.limits) {
    if (!isRecord(limit)) continue;
    const minutes = windowMinutes(limit);
    const utilization = usedPercent(limit);
    if (minutes === null || utilization === null) continue;
    const shape = describe(limit.type, minutes);
    if (!shape || seen.has(shape.key)) continue;
    seen.add(shape.key);
    const resetMs = num(limit.nextResetTime);
    let resetsAt = resetMs !== null && resetMs > 0 ? new Date(resetMs) : null;
    // A 5-hour window cannot reset more than 5 hours away: drop such a reset, keep the value.
    if (resetsAt && minutes === FIVE_HOURS && resetsAt.getTime() > now.getTime() + 301 * 60_000) {
      resetsAt = null;
    }
    windows.push({
      key: shape.key,
      kind: shape.kind,
      label: shape.label,
      utilization: Math.round(utilization * 100) / 100,
      resetsAt: resetsAt ? isoOrNull(resetsAt) : null,
      windowMinutes: minutes,
    });
  }
  const order: Record<WindowKind, number> = {
    session: 0,
    weekly: 1,
    weekly_model: 2,
    monthly: 3,
    other: 4,
  };
  windows.sort((a, b) => order[a.kind] - order[b.kind]);
  return { windows: windows.slice(0, 20), reportedPlan: str(data.level)?.toLowerCase() ?? null };
}

function failure(status: SnapshotStatus, message: string, apiKey: string): QuotaReading {
  const scrubbed = apiKey ? message.split(apiKey).join('[key]') : message;
  return { status, message: scrubbed.slice(0, 500), reportedPlan: null, snapshot: null };
}

/** True for a key that can be sent as a header value: one line of printable ASCII. */
export function isPlausibleApiKey(apiKey: string): boolean {
  return apiKey.length >= 8 && apiKey.length <= 512 && /^[\x21-\x7e]+$/.test(apiKey);
}

/** One reading of a Coding Plan's limits with the person's key. Never throws. */
export async function readZaiQuota(env: QuotaEnv, request: QuotaRequest): Promise<QuotaReading> {
  const reader = UNOFFICIAL_USAGE_READERS[request.provider];
  const apiKey = request.apiKey.trim();
  const site = request.provider === 'bigmodel' ? 'BigModel' : 'Z.AI';
  if (!reader) return failure('error', 'This provider has no usage reader.', apiKey);
  if (!isPlausibleApiKey(apiKey)) {
    return failure('no_credentials', `That does not look like a ${site} API key.`, apiKey);
  }
  const url = new URL(QUOTA_PATH, reader.origin);
  if (url.protocol !== 'https:')
    return failure('error', 'Refusing to send a key over HTTP.', apiKey);

  let res: Response;
  try {
    res = await env.fetch(url, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
        'Accept-Language': 'en-US,en',
        'User-Agent': env.userAgent,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return failure('error', `Could not reach ${site} (${errorMessage(err)}).`, apiKey);
  }

  if (res.status === 401 || res.status === 403) {
    await res.body?.cancel().catch(() => undefined);
    return failure(
      'auth_expired',
      `${site} refused the key. Paste a current Coding Plan key to keep reading usage.`,
      apiKey,
    );
  }
  if (res.status === 429) {
    await res.body?.cancel().catch(() => undefined);
    return failure('rate_limited', `${site} is rate limiting usage requests.`, apiKey);
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    return failure('error', `${site}'s usage endpoint answered ${res.status}.`, apiKey);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return failure(
      'error',
      `${site}'s usage endpoint sent something ResetOwl cannot read.`,
      apiKey,
    );
  }
  const now = env.now();
  const parsed = parseZaiQuota(body, now);
  if (!parsed || parsed.windows.length === 0) {
    // A refused key often comes back as a 200 with `success: false` and a message.
    const msg = isRecord(body) ? str(body.msg) : null;
    const detail = msg ? `: ${msg}` : '';
    return failure(
      'error',
      `${site}'s usage endpoint answered without usable limits${detail}. It is unofficial and may have changed.`,
      apiKey,
    );
  }
  return {
    status: 'ok',
    message: null,
    reportedPlan: parsed.reportedPlan,
    snapshot: { ...snapshot(now, 'ok', null, parsed.windows), source: 'unofficial' },
  };
}

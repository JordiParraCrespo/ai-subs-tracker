import type { ExtraUsage, LimitWindow, WindowKind } from '@flama/shared/schemas/accounts';
import { isRecord, type JsonRecord, num, percent, str, toIso } from '../lib/util';

/**
 * The endpoint behind ChatGPT's Codex usage page. Undocumented, so parsing
 * is tolerant: `rate_limit.primary_window` / `secondary_window` with
 * `used_percent`, `limit_window_seconds` and `reset_at` (epoch seconds) or
 * `reset_after_seconds`.
 */
export const WHAM_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
export const WHAM_TIMEOUT_MS = 10_000;

export class CodexHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'CodexHttpError';
  }
}

export async function fetchCodexUsage(
  accessToken: string,
  accountId: string | null,
  fetchImpl: typeof fetch,
  userAgent: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'User-Agent': userAgent,
  };
  if (accountId) headers['ChatGPT-Account-Id'] = accountId;
  const res = await fetchImpl(WHAM_USAGE_URL, {
    headers,
    signal: AbortSignal.timeout(WHAM_TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new CodexHttpError(res.status);
  }
  return res.json();
}

/** Kind and label for a window of `minutes`: ≤ 6h a session, about 7 days weekly. */
export function classifyCodexWindow(minutes: number | null): { kind: WindowKind; label: string } {
  if (minutes === null) return { kind: 'other', label: 'Limit' };
  if (minutes <= 360) {
    const hours = Math.round(minutes / 60);
    return { kind: 'session', label: hours > 0 ? `Session (${hours}h)` : 'Session' };
  }
  if (minutes >= 6 * 1440 && minutes <= 8 * 1440) return { kind: 'weekly', label: 'Weekly' };
  if (minutes >= 28 * 1440 && minutes <= 31 * 1440) return { kind: 'monthly', label: 'Monthly' };
  const days = Math.round(minutes / 1440);
  return { kind: 'other', label: days >= 1 ? `${days}-day limit` : `${minutes}-minute limit` };
}

/** Legacy order when the length is unknown: primary is the session, secondary the week. */
function fallbackKind(key: string, minutes: number | null): { kind: WindowKind; label: string } {
  if (minutes !== null) return classifyCodexWindow(minutes);
  if (key === 'primary') return { kind: 'session', label: 'Session' };
  if (key === 'secondary') return { kind: 'weekly', label: 'Weekly' };
  return classifyCodexWindow(null);
}

export interface RawCodexWindow {
  usedPercent: unknown;
  minutes: number | null;
  /** Absolute reset, ISO, or null. */
  resetsAt: string | null;
}

export function codexWindow(key: string, raw: RawCodexWindow): LimitWindow | null {
  const utilization = percent(raw.usedPercent);
  if (utilization === null && raw.resetsAt === null) return null;
  const { kind, label } = fallbackKind(key, raw.minutes);
  return {
    key,
    kind,
    label,
    utilization,
    resetsAt: raw.resetsAt,
    windowMinutes: raw.minutes,
  };
}

function relativeReset(seconds: unknown, from: Date): string | null {
  const n = num(seconds);
  return n === null ? null : new Date(from.getTime() + n * 1000).toISOString();
}

function backendWindow(key: string, value: unknown, now: Date): LimitWindow | null {
  if (!isRecord(value)) return null;
  const seconds = num(value.limit_window_seconds);
  return codexWindow(key, {
    usedPercent: value.used_percent,
    minutes: seconds !== null && seconds > 0 ? Math.ceil(seconds / 60) : null,
    resetsAt: toIso(value.reset_at) ?? relativeReset(value.reset_after_seconds, now),
  });
}

/** Pay-as-you-go credits, when the response carries them. */
function creditsFrom(value: unknown): ExtraUsage | null {
  if (!isRecord(value)) return null;
  return {
    enabled: value.has_credits === true || value.unlimited === true,
    monthlyLimit: null,
    usedCredits: null,
    utilization: null,
    currency: null,
  };
}

export function sortCodexWindows(windows: LimitWindow[]): LimitWindow[] {
  const rank: Record<WindowKind, number> = {
    session: 0,
    weekly: 1,
    weekly_model: 2,
    monthly: 3,
    other: 4,
  };
  return windows.sort((a, b) => rank[a.kind] - rank[b.kind] || a.key.localeCompare(b.key));
}

export function parseCodexUsage(
  raw: unknown,
  now: Date,
): { planType: string | null; windows: LimitWindow[]; extraUsage: ExtraUsage | null } {
  if (!isRecord(raw)) return { planType: null, windows: [], extraUsage: null };
  const rateLimit: JsonRecord = isRecord(raw.rate_limit) ? raw.rate_limit : {};
  const windows = [
    backendWindow('primary', rateLimit.primary_window, now),
    backendWindow('secondary', rateLimit.secondary_window, now),
  ].filter((w): w is LimitWindow => w !== null);
  return {
    planType: str(raw.plan_type),
    windows: sortCodexWindows(windows),
    extraUsage: creditsFrom(raw.credits),
  };
}

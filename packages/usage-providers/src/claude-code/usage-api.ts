import type { ExtraUsage, LimitWindow, WindowKind } from '@flama/shared/schemas/accounts';
import { fitWindow, isRecord, type JsonRecord, num, percent, str, toIso } from '../lib/util';

/**
 * The endpoint behind Claude Code's `/usage` screen. It is not a documented
 * public API, so parsing is tolerant: any top-level object shaped like
 * `{ utilization, resets_at }` is a limit window, and unknown keys still come
 * through with a generated label instead of being dropped.
 */
export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
export const OAUTH_BETA_HEADER = 'oauth-2025-04-20';
export const USAGE_TIMEOUT_MS = 10_000;

export const SESSION_MINUTES = 300;
export const WEEK_MINUTES = 10_080;

/** `seven_day_<suffix>` keys whose suffix is not a model family. */
const NON_MODEL_SUFFIXES = new Set(['oauth_apps']);

export class UsageHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'UsageHttpError';
  }
}

export async function fetchClaudeUsage(
  accessToken: string,
  fetchImpl: typeof fetch,
  userAgent: string,
): Promise<unknown> {
  const res = await fetchImpl(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': OAUTH_BETA_HEADER,
      Accept: 'application/json',
      'User-Agent': userAgent,
    },
    signal: AbortSignal.timeout(USAGE_TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new UsageHttpError(res.status);
  }
  return res.json();
}

function titleCase(word: string): string {
  return /^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

function humanize(key: string): string {
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(titleCase)
    .join(' ');
}

/** Kind, label and window length for a Claude window key. */
export function classifyClaudeKey(key: string): {
  kind: WindowKind;
  label: string;
  windowMinutes: number | null;
} {
  if (key === 'five_hour')
    return { kind: 'session', label: 'Session (5h)', windowMinutes: SESSION_MINUTES };
  if (key === 'seven_day') {
    return { kind: 'weekly', label: 'Weekly · all models', windowMinutes: WEEK_MINUTES };
  }
  const weekly = /^seven_day_(.+)$/.exec(key);
  if (weekly?.[1]) {
    const suffix = weekly[1];
    if (NON_MODEL_SUFFIXES.has(suffix)) {
      return { kind: 'other', label: `Weekly · ${humanize(suffix)}`, windowMinutes: WEEK_MINUTES };
    }
    return {
      kind: 'weekly_model',
      label: `Weekly · ${humanize(suffix)}`,
      windowMinutes: WEEK_MINUTES,
    };
  }
  return { kind: 'other', label: humanize(key) || key, windowMinutes: null };
}

function windowFrom(key: string, value: JsonRecord): LimitWindow {
  const { kind, label, windowMinutes } = classifyClaudeKey(key);
  return {
    key: key.slice(0, 80),
    kind,
    label: label.slice(0, 80),
    utilization: percent(value.utilization ?? value.used_percentage),
    resetsAt: toIso(value.resets_at),
    windowMinutes,
  };
}

function minutesOf(entry: JsonRecord): number | null {
  const minutes = num(entry.window_minutes);
  if (minutes !== null && minutes > 0) return Math.round(minutes);
  const seconds = num(entry.window_seconds ?? entry.limit_window_seconds);
  if (seconds !== null && seconds > 0) return Math.max(1, Math.round(seconds / 60));
  return null;
}

/**
 * One entry of a `limits[]` array — a shape newer responses may carry. An
 * entry naming a model is that model's weekly cap; otherwise its key (or
 * window length) decides.
 */
function windowFromLimitEntry(entry: JsonRecord, index: number): LimitWindow | null {
  const utilization = percent(entry.utilization ?? entry.used_percentage ?? entry.used_percent);
  const resetsAt = toIso(entry.resets_at ?? entry.reset_at);
  if (utilization === null && resetsAt === null) return null;
  const model = str(entry.model) ?? str(entry.model_family) ?? str(entry.scope_model);
  const rawKey = str(entry.key) ?? str(entry.id) ?? str(entry.name) ?? str(entry.type);
  const minutes = minutesOf(entry);
  if (model) {
    return {
      key: (rawKey ?? `seven_day_${model}`).slice(0, 80),
      kind: 'weekly_model',
      label: `Weekly · ${humanize(model)}`.slice(0, 80),
      utilization,
      resetsAt,
      windowMinutes: minutes ?? WEEK_MINUTES,
    };
  }
  const key = rawKey ?? `limit_${index}`;
  const classified = classifyClaudeKey(key);
  let kind = classified.kind;
  if (kind === 'other' && minutes !== null) {
    if (minutes <= 360) kind = 'session';
    else if (minutes >= 6 * 1440 && minutes <= 8 * 1440) kind = 'weekly';
    else if (minutes >= 28 * 1440) kind = 'monthly';
  }
  return {
    key: key.slice(0, 80),
    kind,
    label: (str(entry.label) ?? classified.label).slice(0, 80),
    utilization,
    resetsAt,
    windowMinutes: minutes ?? classified.windowMinutes,
  };
}

const RANK: Record<WindowKind, number> = {
  session: 0,
  weekly: 1,
  weekly_model: 2,
  monthly: 3,
  other: 4,
};

export function sortWindows(windows: LimitWindow[]): LimitWindow[] {
  return windows.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.key.localeCompare(b.key));
}

function extraUsageFrom(value: JsonRecord): ExtraUsage {
  return {
    enabled: value.is_enabled === true || value.enabled === true,
    monthlyLimit: num(value.monthly_limit),
    usedCredits: num(value.used_credits),
    utilization: num(value.utilization),
    currency: str(value.currency)?.slice(0, 8) ?? null,
  };
}

export function parseClaudeUsage(raw: unknown): {
  windows: LimitWindow[];
  extraUsage: ExtraUsage | null;
} {
  const windows: LimitWindow[] = [];
  let extraUsage: ExtraUsage | null = null;
  if (!isRecord(raw)) return { windows, extraUsage };

  for (const [key, value] of Object.entries(raw)) {
    if (key === 'limits' && Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (!isRecord(entry)) return;
        const window = windowFromLimitEntry(entry, index);
        if (window && !windows.some((w) => w.key === window.key)) windows.push(window);
      });
      continue;
    }
    if (!isRecord(value)) continue;
    if (key === 'extra_usage') {
      extraUsage = extraUsageFrom(value);
      continue;
    }
    if (!('utilization' in value) && !('resets_at' in value)) continue;
    if (windows.some((w) => w.key === key)) continue;
    windows.push(windowFrom(key, value));
  }
  return { windows: sortWindows(windows), extraUsage };
}

/**
 * The `rate_limits` block of the JSON Claude Code pipes to a statusline
 * command: `{ five_hour: { used_percentage | utilization, resets_at }, … }`,
 * `resets_at` in epoch seconds or ISO. Null when the block is absent.
 */
export function parseClaudeStatusline(json: unknown): LimitWindow[] | null {
  let data = json;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!isRecord(data) || !isRecord(data.rate_limits)) return null;
  const windows: LimitWindow[] = [];
  for (const [key, value] of Object.entries(data.rate_limits)) {
    if (!isRecord(value)) continue;
    const window = windowFrom(key, value);
    if (window.utilization === null && window.resetsAt === null) continue;
    windows.push(window);
  }
  return windows.length > 0 ? sortWindows(windows).slice(0, 20).map(fitWindow) : null;
}

import type { LimitWindow } from '@flama/shared/schemas/accounts';
import { isRecord, type JsonRecord, num, str, toIso } from '../lib/util';

/**
 * Grok Build's usage view, read the way Orca reads it (which works against
 * xAI today): `GET <proxy>/billing?format=credits` on the CLI chat proxy, the
 * call behind the CLI's own `/usage`, with the session token from `auth.json`,
 * `X-XAI-Token-Auth: xai-grok-cli` and the account's `x-userid`. No
 * `User-Agent` is set here: the request carries the HTTP client's own (the
 * desktop app's Chromium one), as Orca's does.
 *
 * The response's shape is not published. The fields sit under `config` or at
 * the top level: `creditUsagePercent` is the share of the weekly pool used,
 * `currentPeriod` (or `billingPeriodStart/End`) bounds it, `subscriptionTier`
 * names the plan, and accounts on unified billing report a monthly
 * `monthlyLimit` / `used` in dollars instead — sometimes only in the default
 * view (`/billing` without `format=credits`), which is asked as a fallback.
 */
export const GROK_PROXY_BASE = 'https://cli-chat-proxy.grok.com/v1';
export const BILLING_CREDITS_URL = `${GROK_PROXY_BASE}/billing?format=credits`;
export const BILLING_DEFAULT_URL = `${GROK_PROXY_BASE}/billing`;
export const BILLING_TIMEOUT_MS = 10_000;
export const GROK_CLI_AUTH_HEADER = 'xai-grok-cli';

const WEEK_MINUTES = 7 * 24 * 60;
const MONTH_MINUTES = 30 * 24 * 60;

/** The flat fields a response without `config` may carry its billing in. */
const FLAT_BILLING_FIELDS = [
  'creditUsagePercent',
  'currentPeriod',
  'billingPeriodStart',
  'billingPeriodEnd',
  'subscriptionTier',
  'monthlyLimit',
  'used',
  'onDemandCap',
  'onDemandUsed',
  'prepaidBalance',
] as const;

export class GrokHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'GrokHttpError';
  }
}

export interface GrokSession {
  accessToken: string;
  userId: string | null;
}

export function grokRequestHeaders(session: GrokSession): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-XAI-Token-Auth': GROK_CLI_AUTH_HEADER,
    Accept: 'application/json',
  };
  if (session.userId) headers['x-userid'] = session.userId;
  return headers;
}

export async function fetchGrokBilling(
  url: string,
  session: GrokSession,
  fetchImpl: typeof fetch,
): Promise<JsonRecord> {
  const res = await fetchImpl(url, {
    headers: grokRequestHeaders(session),
    signal: AbortSignal.timeout(BILLING_TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new GrokHttpError(res.status);
  }
  const data: unknown = await res.json();
  return isRecord(data) ? data : {};
}

/** A `{ val }` money field, as a number of dollars. */
function money(value: unknown): number | null {
  if (!isRecord(value)) return null;
  const raw = value.val;
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function periodEnd(config: JsonRecord): string | null {
  const period = isRecord(config.currentPeriod) ? config.currentPeriod : null;
  return toIso(period?.end) ?? toIso(config.billingPeriodEnd);
}

function sameInstant(left: unknown, right: unknown): boolean {
  const a = typeof left === 'string' ? Date.parse(left) : Number.NaN;
  const b = typeof right === 'string' ? Date.parse(right) : Number.NaN;
  return Number.isFinite(a) && a === b;
}

/** The weekly period is confirmed when `currentPeriod` is weekly and matches the billing bounds. */
function hasConfirmedWeeklyPeriod(config: JsonRecord): boolean {
  const period = isRecord(config.currentPeriod) ? config.currentPeriod : null;
  return (
    period?.type === 'USAGE_PERIOD_TYPE_WEEKLY' &&
    sameInstant(period.start, config.billingPeriodStart) &&
    sameInstant(period.end, config.billingPeriodEnd)
  );
}

function usageScalars(config: JsonRecord): unknown[] {
  return [
    config.onDemandCap,
    config.onDemandUsed,
    config.prepaidBalance,
    config.monthlyLimit,
    config.used,
  ];
}

/** A response that leaves the percentage out because usage is not reported, not because it is zero. */
function omittedPercentIsUnreported(config: JsonRecord): boolean {
  const cap = isRecord(config.onDemandCap) ? config.onDemandCap.val : undefined;
  if (money(config.onDemandCap) === 0 && Number(cap) === 0) {
    return [config.onDemandUsed, config.used].some((value) => (money(value) ?? 0) > 0);
  }
  return usageScalars(config).some((value) => money(value) === 0);
}

export function reportsAnyUsageScalar(config: JsonRecord): boolean {
  return usageScalars(config).some((value) => money(value) !== null);
}

function weeklyPercent(config: JsonRecord): number | null {
  const reported = config.creditUsagePercent;
  if (reported !== undefined) return num(reported);
  // A computable monthly budget must not be relabelled as zero weekly usage.
  if (omittedPercentIsUnreported(config) || monthlyWindow(config) !== null) return null;
  return hasConfirmedWeeklyPeriod(config) ? 0 : null;
}

export function weeklyWindow(config: JsonRecord): LimitWindow | null {
  const used = weeklyPercent(config);
  if (used === null) return null;
  return {
    key: 'weekly',
    kind: 'weekly',
    label: 'Weekly',
    utilization: Math.min(Math.max(used, 0), 100),
    resetsAt: periodEnd(config),
    windowMinutes: WEEK_MINUTES,
  };
}

export function monthlyWindow(config: JsonRecord): LimitWindow | null {
  const limit = money(config.monthlyLimit);
  const used = money(config.used);
  // An invalid or zero denominator cannot give a percentage.
  if (limit === null || used === null || limit <= 0) return null;
  return {
    key: 'monthly',
    kind: 'monthly',
    label: 'Monthly',
    utilization: Math.min(Math.max((used / limit) * 100, 0), 100),
    resetsAt: periodEnd(config),
    windowMinutes: MONTH_MINUTES,
  };
}

/** The billing config of a response: under `config`, or flat; null when it carries none. */
export function billingConfig(data: JsonRecord): JsonRecord | null {
  if (isRecord(data.config)) return data.config;
  return FLAT_BILLING_FIELDS.some((field) => data[field] !== undefined) ? data : null;
}

/** The tier as the proxy names it (`supergrok`, `supergrok_heavy`, …). */
export function billingTier(config: JsonRecord, data: JsonRecord): string | null {
  return (
    str(config.subscriptionTier)?.trim() ??
    str(config.subscription_tier) ??
    str(data.subscription_tier) ??
    null
  );
}

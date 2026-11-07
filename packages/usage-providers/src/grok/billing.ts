import type { LimitWindow } from '@flama/shared/schemas/accounts';
import { isRecord, type JsonRecord, num, percent, str, toIso } from '../lib/util';

/**
 * Grok Build's usage view: `GET <proxy>/billing?format=credits` on the CLI
 * chat proxy, the call behind the CLI's own `/usage`. The CLI's bundled docs
 * describe calling this proxy with the session token from `auth.json` and
 * `X-XAI-Token-Auth: xai-grok-cli`, which tells the proxy's auth middleware
 * to validate the bearer as a CLI session token; it names the token, not the
 * caller, and the `User-Agent` stays ResetOwl's own.
 *
 * The response's shape is not published, so parsing is tolerant: the fields
 * sit under `config` or at the top level, `creditUsagePercent` is the share of
 * the weekly pool used, `currentPeriod` (or `billingPeriodStart/End`) bounds
 * it, `subscriptionTier` names the plan, and accounts on unified billing may
 * report a monthly `monthlyLimit` / `used` in dollars instead of a percentage.
 */
export const GROK_PROXY_BASE = 'https://cli-chat-proxy.grok.com/v1';
export const BILLING_URL = `${GROK_PROXY_BASE}/billing?format=credits`;
export const BILLING_TIMEOUT_MS = 10_000;

const WEEK_MINUTES = 7 * 24 * 60;
const MONTH_MINUTES = 30 * 24 * 60;

export class GrokHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'GrokHttpError';
  }
}

export async function fetchGrokBilling(
  accessToken: string,
  fetchImpl: typeof fetch,
  userAgent: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'X-XAI-Token-Auth': 'xai-grok-cli',
    Accept: 'application/json',
    'User-Agent': userAgent,
  };
  const res = await fetchImpl(BILLING_URL, {
    headers,
    signal: AbortSignal.timeout(BILLING_TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new GrokHttpError(res.status);
  }
  return res.json();
}

/** A `{ val }` money field, as a number of dollars. */
function money(value: unknown): number | null {
  return isRecord(value) ? num(value.val) : num(value);
}

function periodEnd(config: JsonRecord): string | null {
  const period = isRecord(config.currentPeriod) ? config.currentPeriod : null;
  return toIso(period?.end) ?? toIso(config.billingPeriodEnd);
}

function weeklyWindow(config: JsonRecord): LimitWindow | null {
  const utilization = percent(config.creditUsagePercent);
  if (utilization === null) return null;
  return {
    key: 'weekly',
    kind: 'weekly',
    label: 'Weekly',
    utilization: Math.min(utilization, 100),
    resetsAt: periodEnd(config),
    windowMinutes: WEEK_MINUTES,
  };
}

function monthlyWindow(config: JsonRecord): LimitWindow | null {
  const limit = money(config.monthlyLimit);
  const used = money(config.used);
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

export interface GrokBilling {
  /** The tier as the proxy names it (`supergrok`, `supergrok_heavy`, …). */
  tier: string | null;
  windows: LimitWindow[];
}

export function parseGrokBilling(raw: unknown): GrokBilling {
  if (!isRecord(raw)) return { tier: null, windows: [] };
  const config: JsonRecord = isRecord(raw.config) ? raw.config : raw;
  const tier =
    str(config.subscriptionTier) ?? str(config.subscription_tier) ?? str(raw.subscription_tier);
  // The weekly pool when the account has one; a unified-billing account's
  // monthly budget otherwise. Never both: one is the other relabelled.
  const weekly = weeklyWindow(config);
  const monthly = weekly ? null : monthlyWindow(config);
  return { tier, windows: [weekly ?? monthly].filter((w): w is LimitWindow => w !== null) };
}

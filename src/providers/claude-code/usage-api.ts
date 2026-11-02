import type { ExtraUsage, UsageWindow } from "../../types.js";

/**
 * The endpoint behind Claude Code's `/usage` screen. It is not a documented
 * public API, so parsing is deliberately tolerant: any top-level object shaped
 * like `{ utilization, resets_at }` is treated as a limit window, and unknown
 * keys still show up (with a generated label) instead of being dropped.
 */
export const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
export const OAUTH_BETA_HEADER = "oauth-2025-04-20";

const KNOWN_WINDOWS: Record<string, string> = {
  five_hour: "Session (5h)",
  seven_day: "Weekly · all models",
  seven_day_opus: "Weekly · Opus",
  seven_day_sonnet: "Weekly · Sonnet",
  seven_day_oauth_apps: "Weekly · OAuth apps",
};
const ORDER = Object.keys(KNOWN_WINDOWS);

export class UsageApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UsageApiError";
  }
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export async function fetchUsage(accessToken: string, fetchImpl: typeof fetch): Promise<unknown> {
  const res = await fetchImpl(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "anthropic-beta": OAUTH_BETA_HEADER,
      Accept: "application/json",
      "User-Agent": "ai-subs-tracker",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const hint =
      res.status === 401 || res.status === 403
        ? "login rejected"
        : res.status === 429
          ? "rate limited, try again in a minute"
          : `HTTP ${res.status}`;
    throw new UsageApiError(`Usage request failed: ${hint}`, res.status);
  }
  return res.json();
}

function humanizeKey(key: string): string {
  return key
    .split("_")
    .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseUsage(raw: unknown): { windows: UsageWindow[]; extraUsage?: ExtraUsage } {
  const windows: UsageWindow[] = [];
  let extraUsage: ExtraUsage | undefined;
  if (!raw || typeof raw !== "object") return { windows };

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;

    if (key === "extra_usage") {
      extraUsage = {
        enabled: v.is_enabled === true,
        monthlyLimit: num(v.monthly_limit),
        usedCredits: num(v.used_credits),
        utilization: num(v.utilization),
      };
      continue;
    }
    if (!("utilization" in v) && !("resets_at" in v)) continue;

    windows.push({
      key,
      label: KNOWN_WINDOWS[key] ?? humanizeKey(key),
      utilization: num(v.utilization),
      resetsAt: isoOrNull(v.resets_at),
    });
  }

  const rank = (k: string) => {
    const i = ORDER.indexOf(k);
    return i === -1 ? ORDER.length : i;
  };
  windows.sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
  return { windows, extraUsage };
}

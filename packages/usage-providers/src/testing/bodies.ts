/**
 * What the vendors answer, as bodies: the shapes ResetOwl reads today, built
 * from a few numbers, and the shapes it must survive (`HOSTILE_BODIES`).
 */

const iso = (at: Date | number) => new Date(at).toISOString();

/** Anthropic's `/api/oauth/usage`: a 5-hour session, the week, and one model's week. */
export function claudeUsageBody(
  opts: {
    session?: number | null;
    weekly?: number | null;
    /** A model family's weekly cap, e.g. `{ opus: 40 }`. */
    models?: Record<string, number>;
    sessionResetsAt?: Date | number;
    weeklyResetsAt?: Date | number;
    extraUsage?: { monthlyLimit: number; usedCredits: number } | null;
  } = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const session = opts.session === undefined ? 42 : opts.session;
  const weekly = opts.weekly === undefined ? 18 : opts.weekly;
  const sessionResets = opts.sessionResetsAt ? iso(opts.sessionResetsAt) : null;
  const weeklyResets = opts.weeklyResetsAt ? iso(opts.weeklyResetsAt) : null;
  body.five_hour = session === null ? null : { utilization: session, resets_at: sessionResets };
  body.seven_day = weekly === null ? null : { utilization: weekly, resets_at: weeklyResets };
  for (const [model, utilization] of Object.entries(opts.models ?? {})) {
    body[`seven_day_${model}`] = { utilization, resets_at: weeklyResets };
  }
  if (opts.extraUsage) {
    body.extra_usage = {
      is_enabled: true,
      monthly_limit: opts.extraUsage.monthlyLimit,
      used_credits: opts.extraUsage.usedCredits,
      utilization: (opts.extraUsage.usedCredits / opts.extraUsage.monthlyLimit) * 100,
    };
  }
  return body;
}

/** ChatGPT's `wham/usage`: the 5-hour primary window and the weekly secondary one. */
export function codexUsageBody(
  opts: {
    plan?: string;
    session?: number | null;
    weekly?: number | null;
    sessionResetsAt?: Date | number;
    weeklyResetsAt?: Date | number;
  } = {},
): Record<string, unknown> {
  const window = (used: number, seconds: number, resetsAt?: Date | number) => ({
    used_percent: used,
    limit_window_seconds: seconds,
    ...(resetsAt === undefined
      ? {}
      : { reset_at: Math.round(new Date(resetsAt).getTime() / 1000) }),
  });
  const session = opts.session === undefined ? 35 : opts.session;
  const weekly = opts.weekly === undefined ? 12 : opts.weekly;
  const rateLimit: Record<string, unknown> = {};
  if (session !== null) {
    rateLimit.primary_window = window(session, 18_000, opts.sessionResetsAt);
    if (weekly !== null) rateLimit.secondary_window = window(weekly, 604_800, opts.weeklyResetsAt);
  } else if (weekly !== null) {
    // A weekly-only plan reports the week as its primary window.
    rateLimit.primary_window = window(weekly, 604_800, opts.weeklyResetsAt);
  }
  return { plan_type: opts.plan ?? 'plus', rate_limit: rateLimit };
}

/** Grok Build's billing view: the weekly credit pool and the tier. */
export function grokBillingBody(
  opts: { tier?: string; weekly?: number; periodEnd?: Date | number } = {},
): Record<string, unknown> {
  return {
    config: {
      creditUsagePercent: opts.weekly ?? 27.5,
      subscriptionTier: opts.tier ?? 'supergrok',
      currentPeriod: {
        type: 'USAGE_PERIOD_TYPE_WEEKLY',
        ...(opts.periodEnd === undefined ? {} : { end: iso(opts.periodEnd) }),
      },
    },
  };
}

/** The Z.AI / BigModel quota answer: the 5-hour and weekly token limits and the MCP month. */
export function zaiQuotaBody(
  opts: {
    level?: string;
    session?: number;
    weekly?: number;
    mcp?: number;
    sessionResetsAt?: Date | number;
    weeklyResetsAt?: Date | number;
  } = {},
): Record<string, unknown> {
  const ms = (at: Date | number | undefined) =>
    at === undefined ? undefined : new Date(at).getTime();
  return {
    code: 200,
    success: true,
    data: {
      level: opts.level ?? 'Pro',
      limits: [
        {
          type: 'TOKENS_LIMIT',
          unit: 3,
          number: 5,
          percentage: opts.session ?? 12,
          nextResetTime: ms(opts.sessionResetsAt),
        },
        {
          type: 'TOKENS_LIMIT',
          unit: 6,
          number: 1,
          percentage: opts.weekly ?? 44,
          nextResetTime: ms(opts.weeklyResetsAt),
        },
        { type: 'TIME_LIMIT', unit: 5, number: 1, percentage: opts.mcp ?? 3 },
      ],
    },
  };
}

function deep(depth: number): unknown {
  let value: unknown = { utilization: 50, resets_at: '2026-11-05T00:00:00Z' };
  for (let i = 0; i < depth; i++) value = i % 2 ? { nested: value } : [value];
  return value;
}

const LONG = 'x'.repeat(5_000);

/**
 * Answers a vendor could send that are not the shape ResetOwl expects, named
 * for the failure each one stands for. Every reader must turn each into a
 * reading the sync contract accepts; none may throw.
 */
export const HOSTILE_BODIES: ReadonlyArray<{ name: string; body: unknown }> = [
  { name: 'null', body: null },
  { name: 'an empty object', body: {} },
  { name: 'an empty array', body: [] },
  { name: 'a string', body: 'Service Unavailable' },
  { name: 'a number', body: 42 },
  { name: 'a boolean', body: false },
  { name: 'an error envelope', body: { error: { type: 'overloaded_error', message: 'busy' } } },
  {
    name: 'every field the wrong type',
    body: {
      five_hour: 'soon',
      seven_day: [1, 2, 3],
      limits: 'none',
      rate_limit: 7,
      plan_type: { name: 'pro' },
      config: 'weekly',
      data: [],
      extra_usage: 'yes',
      credits: 12,
    },
  },
  {
    name: 'numbers out of every range',
    body: {
      five_hour: { utilization: 1e308, resets_at: 8.64e18 },
      seven_day: { utilization: -50, resets_at: -1 },
      seven_day_opus: { utilization: Number.MAX_SAFE_INTEGER, resets_at: 1e-9 },
      rate_limit: {
        primary_window: { used_percent: 1e308, limit_window_seconds: 1e308, reset_at: 1e308 },
        secondary_window: { used_percent: -1, limit_window_seconds: -60, reset_after_seconds: -5 },
      },
      config: { creditUsagePercent: 1e12, monthlyLimit: { val: -1 }, used: { val: 1e308 } },
      data: {
        limits: [
          { type: 'TOKENS_LIMIT', unit: 3, number: 5, percentage: 1e308, nextResetTime: 1e308 },
          { type: 'TOKENS_LIMIT', unit: 6, number: 0, percentage: -3, nextResetTime: -1 },
        ],
      },
    },
  },
  {
    name: 'numbers as strings and dates that are not dates',
    body: {
      five_hour: { utilization: '62', resets_at: 'tomorrow' },
      seven_day: { utilization: 'NaN', resets_at: '0000-00-00T00:00:00Z' },
      rate_limit: {
        primary_window: { used_percent: '42', limit_window_seconds: '18000', reset_at: 'soon' },
      },
      config: { creditUsagePercent: '37.5', currentPeriod: { end: 'never' } },
      data: {
        level: 7,
        limits: [{ type: 'TOKENS_LIMIT', unit: '3', number: '5', percentage: '9' }],
      },
    },
  },
  {
    name: 'more windows than the contract holds',
    body: {
      ...Object.fromEntries(
        Array.from({ length: 60 }, (_, i) => [`seven_day_model_${i}`, { utilization: i }]),
      ),
      limits: Array.from({ length: 60 }, (_, i) => ({ key: `limit_${i}`, utilization: i })),
      data: {
        limits: Array.from({ length: 60 }, (_, i) => ({
          type: 'TOKENS_LIMIT',
          unit: 3,
          number: i + 1,
          percentage: i,
        })),
      },
    },
  },
  {
    name: 'keys and labels far past their lengths',
    body: {
      [`seven_day_${LONG}`]: { utilization: 10 },
      [LONG]: { utilization: 10 },
      limits: [{ key: LONG, label: LONG, model: LONG, utilization: 5 }],
      plan_type: LONG,
      config: { creditUsagePercent: 5, subscriptionTier: LONG },
      data: { level: LONG, limits: [{ type: LONG, unit: 3, number: 5, percentage: 1 }] },
      extra_usage: { is_enabled: true, currency: LONG },
    },
  },
  {
    name: 'markup and control characters in every string',
    body: {
      '<img src=x onerror=alert(1)>': { utilization: 5 },
      'seven_day_\u0000‮<script>': { utilization: 5 },
      limits: [
        { key: '"; DROP TABLE account;--', label: '\u0000\u0007\u001b[31m', utilization: 5 },
      ],
      plan_type: '<b>pro</b>\u0000',
      config: { creditUsagePercent: 5, subscriptionTier: '{{7*7}}%s%n../../etc/passwd' },
      data: { level: '‮pro', limits: [{ type: 'TOKENS_LIMIT', unit: 3, number: 5 }] },
    },
  },
  {
    name: 'keys of Object.prototype',
    // Built from text: an object literal would set the prototype, not a key.
    body: JSON.parse(
      '{"__proto__":{"utilization":99},"constructor":{"utilization":5},"toString":{"utilization":5},"hasOwnProperty":{"utilization":5},"rate_limit":{"__proto__":{"primary_window":{"used_percent":5}}},"config":{"__proto__":{"creditUsagePercent":5}},"data":{"__proto__":{"limits":[]}}}',
    ),
  },
  { name: 'nesting a hundred levels deep', body: { five_hour: deep(100), limits: [deep(100)] } },
  {
    name: 'a success envelope that refuses',
    body: { code: 401, success: false, msg: 'token expired or incorrect', data: null },
  },
];

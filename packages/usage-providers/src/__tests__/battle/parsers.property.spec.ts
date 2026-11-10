import {
  dailyTokensSchema,
  limitWindowSchema,
  reportedRenewalSchema,
  usageSnapshotSchema,
} from '@flama/shared/schemas/accounts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseClaudeLogLine } from '../../claude-code/local-logs';
import { parseClaudeStatusline, parseClaudeUsage } from '../../claude-code/usage-api';
import { reportedRenewal } from '../../codex';
import { decodeJwtPayload, parseCodexAuth } from '../../codex/auth';
import { parseSessionRateLimits } from '../../codex/sessions';
import { parseCodexUsage } from '../../codex/usage-api';
import { parseGrokAuth } from '../../grok/auth';
import { parseGrokBilling } from '../../grok/billing';
import { DailyTokenBuckets, snapshot } from '../../lib/util';
import { fakeJwt } from '../../testing';
import { parseZaiQuota } from '../../zai/quota';

/**
 * The vendors' answers and the CLIs' files are undocumented, so every parser
 * is fed anything at all, and near-misses of the real shapes, thousands of
 * times. What is protected: a parser never throws, and whatever it returns is
 * something the sync contract accepts, because one window the API refuses
 * fails the sync for every account on the machine. A parser that passes a
 * vendor's number, key or label straight through fails here.
 */

const NOW = new Date('2026-11-02T12:00:00Z');
const RUNS = { numRuns: Number(process.env.FUZZ_RUNS ?? 400) };

/** Values a careless vendor puts where a number, a date or a name belongs. */
const scalar = fc.oneof(
  fc.constantFrom(
    null,
    true,
    false,
    0,
    -1,
    -0,
    0.5,
    1,
    99.999,
    100,
    1000,
    1001,
    300,
    18_000,
    604_800,
    1e12,
    1e15,
    1e21,
    1e308,
    -1e308,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    Number.MIN_VALUE,
    '',
    ' ',
    '0',
    '-5',
    '1e999',
    'NaN',
    'Infinity',
    '2026-11-05T00:00:00Z',
    '2026-13-45T99:99:99Z',
    '+275760-09-13T00:00:00.000Z',
    'never',
    'x'.repeat(300),
    '<script>alert(1)</script>',
    '\u0000',
  ),
  fc.double(),
  fc.integer(),
  fc.string(),
);

const anything = fc.oneof(
  { depthSize: 'small' },
  scalar,
  fc.jsonValue(),
  fc.array(scalar, { maxLength: 4 }),
);

/** An object over `keys` (and a few stray ones), each value from `value`. */
const shaped = (keys: readonly string[], value: fc.Arbitrary<unknown>) =>
  fc.dictionary(fc.oneof(fc.constantFrom(...keys), fc.string({ maxLength: 12 })), value, {
    maxKeys: 8,
  });

const WINDOW_KEYS = [
  'utilization',
  'used_percentage',
  'used_percent',
  'resets_at',
  'reset_at',
  'reset_after_seconds',
  'resets_in_seconds',
  'limit_window_seconds',
  'window_seconds',
  'window_minutes',
  'key',
  'id',
  'name',
  'type',
  'label',
  'model',
  'model_family',
  'unit',
  'number',
  'percentage',
  'usage',
  'currentValue',
  'remaining',
  'nextResetTime',
];
const windowLike = fc.oneof(shaped(WINDOW_KEYS, scalar), anything);

function expectWindows(windows: unknown): void {
  expect(Array.isArray(windows)).toBe(true);
  for (const window of windows as unknown[]) {
    const parsed = limitWindowSchema.safeParse(window);
    expect(parsed.error?.issues ?? [], JSON.stringify(window)).toEqual([]);
  }
}

function expectSnapshot(windows: unknown, extraUsage: unknown = null): void {
  // As a provider builds it; the snapshot keeps at most 20 windows.
  const built = snapshot(NOW, 'ok', null, windows as never, extraUsage as never);
  const parsed = usageSnapshotSchema.safeParse(built);
  expect(parsed.error?.issues ?? [], JSON.stringify(built)).toEqual([]);
}

describe('limit parsers take anything and give the contract', () => {
  it('parseClaudeUsage', () => {
    const body = fc.oneof(
      anything,
      shaped(
        [
          'five_hour',
          'seven_day',
          'seven_day_opus',
          'seven_day_sonnet',
          'seven_day_oauth_apps',
          'seven_day_',
          'limits',
          'extra_usage',
        ],
        fc.oneof(
          windowLike,
          fc.array(windowLike, { maxLength: 30 }),
          shaped(
            ['is_enabled', 'monthly_limit', 'used_credits', 'utilization', 'currency'],
            scalar,
          ),
        ),
      ),
    );
    fc.assert(
      fc.property(body, (raw) => {
        const parsed = parseClaudeUsage(raw);
        expectSnapshot(parsed.windows, parsed.extraUsage);
      }),
      RUNS,
    );
  });

  it('parseClaudeStatusline', () => {
    const body = fc.oneof(
      anything,
      fc.record({
        rate_limits: fc.oneof(anything, shaped(['five_hour', 'seven_day'], windowLike)),
      }),
    );
    fc.assert(
      fc.property(body, fc.boolean(), (raw, asText) => {
        const windows = parseClaudeStatusline(asText ? JSON.stringify(raw) : raw);
        if (windows !== null) {
          expect(windows.length).toBeLessThanOrEqual(20);
          expectWindows(windows);
        }
      }),
      RUNS,
    );
  });

  it('parseCodexUsage', () => {
    const body = fc.oneof(
      anything,
      fc.record(
        {
          plan_type: scalar,
          rate_limit: fc.oneof(
            anything,
            shaped(['primary_window', 'secondary_window'], windowLike),
          ),
          credits: fc.oneof(anything, shaped(['has_credits', 'unlimited', 'balance'], scalar)),
        },
        { requiredKeys: [] },
      ),
    );
    fc.assert(
      fc.property(body, (raw) => {
        const parsed = parseCodexUsage(raw, NOW);
        expectSnapshot(parsed.windows, parsed.extraUsage);
      }),
      RUNS,
    );
  });

  it('parseSessionRateLimits', () => {
    const limits = fc.oneof(
      anything,
      shaped(['primary', 'secondary', 'plan_type'], fc.oneof(windowLike, scalar)),
    );
    fc.assert(
      fc.property(limits, fc.date({ noInvalidDate: true }), (raw, observed) => {
        const parsed = parseSessionRateLimits({ rate_limits: raw }, observed);
        if (parsed) expectSnapshot(parsed.windows);
      }),
      RUNS,
    );
  });

  it('parseGrokBilling', () => {
    const config = shaped(
      [
        'creditUsagePercent',
        'subscriptionTier',
        'subscription_tier',
        'currentPeriod',
        'billingPeriodEnd',
        'monthlyLimit',
        'used',
      ],
      fc.oneof(scalar, shaped(['val', 'start', 'end', 'type'], scalar)),
    );
    const body = fc.oneof(anything, config, fc.record({ config: fc.oneof(anything, config) }));
    fc.assert(
      fc.property(body, (raw) => {
        const parsed = parseGrokBilling(raw);
        expect(parsed.windows.length).toBeLessThanOrEqual(1);
        expectSnapshot(parsed.windows);
        for (const window of parsed.windows) expect(window.utilization).toBeLessThanOrEqual(100);
      }),
      RUNS,
    );
  });

  it('parseZaiQuota', () => {
    const limit = fc.oneof(
      windowLike,
      fc.record(
        {
          type: fc.constantFrom('TOKENS_LIMIT', 'CREDIT_LIMIT', 'TIME_LIMIT', 'OTHER'),
          unit: fc.oneof(fc.constantFrom(1, 3, 5, 6), scalar),
          number: scalar,
          percentage: scalar,
          usage: scalar,
          currentValue: scalar,
          remaining: scalar,
          nextResetTime: scalar,
        },
        { requiredKeys: ['type'] },
      ),
    );
    const body = fc.oneof(
      anything,
      fc.record({
        success: fc.constantFrom(true, true, true, false, 'true'),
        code: fc.constantFrom(200, 0, 200, 401, '200'),
        data: fc.oneof(
          anything,
          fc.record({
            level: scalar,
            limits: fc.oneof(anything, fc.array(limit, { maxLength: 30 })),
          }),
        ),
      }),
    );
    fc.assert(
      fc.property(body, (raw) => {
        const parsed = parseZaiQuota(raw, NOW);
        if (!parsed) return;
        expect(parsed.windows.length).toBeLessThanOrEqual(20);
        expectSnapshot(parsed.windows);
        if (parsed.reportedPlan !== null) expect(typeof parsed.reportedPlan).toBe('string');
      }),
      RUNS,
    );
  });
});

describe('file parsers take anything a CLI could leave on disk', () => {
  it('parseClaudeLogLine never throws, and its tokens always make rows the contract accepts', () => {
    const usage = shaped(
      ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'],
      scalar,
    );
    const record = fc.record(
      {
        type: fc.constantFrom('assistant', 'user', 'summary', 7),
        timestamp: scalar,
        requestId: scalar,
        message: fc.oneof(
          anything,
          fc.record(
            { id: scalar, model: scalar, usage: fc.oneof(anything, usage) },
            {
              requiredKeys: [],
            },
          ),
        ),
      },
      { requiredKeys: [] },
    );
    const line = fc.oneof(
      fc.string(),
      record.map((r) => JSON.stringify(r)),
      record.map((r) => JSON.stringify(r).slice(0, -3)),
      fc.constant('{"usage"'),
    );
    fc.assert(
      fc.property(fc.array(line, { maxLength: 20 }), (lines) => {
        const buckets = new DailyTokenBuckets('1970-01-01');
        for (const text of lines) {
          const entry = parseClaudeLogLine(text);
          if (entry) buckets.add(entry.timestamp, entry.model, entry);
        }
        for (const row of buckets.toArray()) {
          const parsed = dailyTokensSchema.safeParse(row);
          expect(parsed.error?.issues ?? [], JSON.stringify(row)).toEqual([]);
        }
      }),
      RUNS,
    );
  });

  it('a Codex login file of any shape gives an identity or nothing, and a billing day the contract accepts', () => {
    const claims = shaped(
      [
        'chatgpt_plan_type',
        'chatgpt_account_id',
        'workspace_name',
        'chatgpt_subscription_active_until',
        'chatgpt_subscription_last_checked',
        'email',
      ],
      scalar,
    );
    const idToken = fc.oneof(
      scalar,
      fc
        .record(
          {
            email: scalar,
            'https://api.openai.com/auth': fc.oneof(anything, claims),
            'https://api.openai.com/profile': fc.oneof(anything, claims),
          },
          { requiredKeys: [] },
        )
        .map((payload) => fakeJwt(payload as Record<string, unknown>)),
      fc.string().map((text) => `a.${text}.c`),
    );
    const file = fc.record(
      {
        OPENAI_API_KEY: scalar,
        tokens: fc.oneof(
          anything,
          fc.record(
            { id_token: idToken, access_token: scalar, account_id: scalar },
            { requiredKeys: [] },
          ),
        ),
      },
      { requiredKeys: [] },
    );
    fc.assert(
      fc.property(file, (data) => {
        const auth = parseCodexAuth(data as Record<string, unknown>);
        const renewal = reportedRenewal(auth);
        if (renewal) {
          const parsed = reportedRenewalSchema.safeParse(renewal);
          expect(parsed.error?.issues ?? [], JSON.stringify(renewal)).toEqual([]);
        }
        for (const field of [auth?.email, auth?.accountId, auth?.planType, auth?.organization]) {
          expect(field === null || field === undefined || typeof field === 'string').toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('decodeJwtPayload and parseGrokAuth never throw', () => {
    fc.assert(
      fc.property(fc.string(), (token) => {
        decodeJwtPayload(token);
      }),
      RUNS,
    );
    const entry = fc.oneof(
      anything,
      shaped(['key', 'user_id', 'email', 'team_id', 'expires_at'], scalar),
    );
    const file = fc.dictionary(
      fc.oneof(
        fc.constantFrom('https://accounts.x.ai/sign-in', 'https://auth.x.ai', 'https://idp.corp'),
        fc.string({ maxLength: 12 }),
      ),
      entry,
      { maxKeys: 5 },
    );
    fc.assert(
      fc.property(file, (data) => {
        const auth = parseGrokAuth(data);
        if (auth) {
          expect(typeof auth.accessToken).toBe('string');
          expect(auth.expiresAt === null || Number.isFinite(auth.expiresAt.getTime())).toBe(true);
        }
      }),
      RUNS,
    );
  });
});

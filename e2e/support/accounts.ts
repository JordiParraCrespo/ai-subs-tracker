import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../playwright.config';

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Reports two logins the way the desktop collector does: a Claude Code Ultra
 * account well behind pace, and a Codex Plus account whose week resets in a
 * few hours with most of it left — the one Tokenmaxx should pick. Codex's
 * login reports its billing day (today's, so it is in the next 30 days);
 * Claude Code's reports none.
 */
export async function syncTwoAccounts(api: APIRequestContext) {
  return api.post(`${API_URL}/api/v1/accounts/sync`, {
    data: {
      device: { name: 'e2e-laptop', platform: 'linux' },
      accounts: [
        {
          provider: 'claude-code',
          externalId: 'e2e-claude',
          email: 'work@example.com',
          organization: null,
          reportedPlan: 'default_claude_max_20x',
          location: '~/.claude',
          snapshot: {
            capturedAt: new Date().toISOString(),
            source: 'poll',
            status: 'ok',
            message: null,
            windows: [
              {
                key: 'seven_day',
                kind: 'weekly',
                label: 'Weekly',
                utilization: 30,
                resetsAt: hoursFromNow(80),
                windowMinutes: 10080,
              },
            ],
            extraUsage: null,
          },
          dailyTokens: [
            {
              day: today(),
              model: 'claude-opus-5-5',
              input: 100_000,
              output: 50_000,
              cacheWrite: 0,
              cacheRead: 1_000_000,
              messages: 40,
            },
          ],
        },
        {
          provider: 'codex',
          externalId: 'e2e-codex',
          email: 'home@example.com',
          organization: null,
          reportedPlan: 'plus',
          location: '~/.codex',
          snapshot: {
            capturedAt: new Date().toISOString(),
            source: 'poll',
            status: 'ok',
            message: null,
            windows: [
              {
                key: 'secondary',
                kind: 'weekly',
                label: 'Weekly',
                utilization: 20,
                resetsAt: hoursFromNow(6),
                windowMinutes: 10080,
              },
            ],
            extraUsage: null,
          },
          dailyTokens: [],
          reportedRenewal: { day: new Date().getDate(), checkedAt: hoursFromNow(-24 * 40) },
        },
      ],
    },
  });
}

type SnapshotStatus =
  | 'ok'
  | 'auth_stale'
  | 'auth_expired'
  | 'no_credentials'
  | 'rate_limited'
  | 'error';

export interface FleetAccount {
  provider: 'claude-code' | 'codex' | 'grok';
  externalId: string;
  email: string | null;
  organization?: string | null;
  reportedPlan?: string | null;
  location?: string | null;
  status?: SnapshotStatus | null;
  message?: string | null;
  /** Percent used of the 5-hour window and of the week; null leaves the window out. */
  session?: number | null;
  weekly?: number | null;
  /** Hours until the week resets. */
  weeklyResetsIn?: number | null;
  /** Extra windows, as the provider would name them. */
  extraWindows?: Array<Record<string, unknown>>;
  tokens?: Array<{ model: string; input: number; output?: number; daysAgo?: number }>;
}

/** One account of a sync, from a few facts about it. */
export function fleetAccount(spec: FleetAccount): Record<string, unknown> {
  const status = spec.status === undefined ? 'ok' : spec.status;
  const windows: Array<Record<string, unknown>> = [];
  if (status === 'ok') {
    if (spec.session !== null && spec.provider !== 'grok') {
      windows.push({
        key: spec.provider === 'codex' ? 'primary' : 'five_hour',
        kind: 'session',
        label: 'Session (5h)',
        utilization: spec.session ?? 40,
        resetsAt: hoursFromNow(2),
        windowMinutes: 300,
      });
    }
    if (spec.weekly !== null) {
      windows.push({
        key: spec.provider === 'codex' ? 'secondary' : 'seven_day',
        kind: 'weekly',
        label: 'Weekly',
        utilization: spec.weekly ?? 25,
        resetsAt: spec.weeklyResetsIn === null ? null : hoursFromNow(spec.weeklyResetsIn ?? 72),
        windowMinutes: 10080,
      });
    }
    windows.push(...(spec.extraWindows ?? []));
  }
  const day = (daysAgo: number) =>
    new Date(Date.now() - daysAgo * 24 * 3_600_000).toISOString().slice(0, 10);
  return {
    provider: spec.provider,
    externalId: spec.externalId,
    email: spec.email,
    organization: spec.organization ?? null,
    reportedPlan: spec.reportedPlan ?? null,
    location: spec.location ?? `~/${spec.externalId}`,
    snapshot:
      status === null
        ? null
        : {
            capturedAt: new Date().toISOString(),
            source: 'poll',
            status,
            message: spec.message ?? null,
            windows,
            extraUsage: null,
          },
    dailyTokens: (spec.tokens ?? []).map((row) => ({
      day: day(row.daysAgo ?? 0),
      model: row.model,
      input: row.input,
      output: row.output ?? 0,
      cacheWrite: 0,
      cacheRead: 0,
      messages: 1,
    })),
  };
}

/** Text a login file or a vendor could carry that a screen must show as text, never run. */
export const HOSTILE_TEXT = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';

/**
 * A machine's worth of accounts in every state the screens must draw: each
 * provider healthy, each failure status, a plan the catalog does not know, a
 * login with no reading at all, usage past 100%, a reset already behind us,
 * names at the contract's lengths, and markup where a name belongs.
 */
export function fleet(tag: string): FleetAccount[] {
  const id = (name: string) => `${tag}-${name}`;
  const mail = (name: string) => `${name}.${tag}@fleet.e2e`;
  return [
    {
      provider: 'claude-code',
      externalId: id('claude-ultra'),
      email: mail('ultra'),
      reportedPlan: 'default_claude_max_20x',
      session: 12,
      weekly: 30,
      tokens: [
        { model: 'claude-opus-4-1', input: 400_000, output: 60_000 },
        { model: 'claude-sonnet-4-5', input: 900_000, output: 80_000, daysAgo: 2 },
      ],
    },
    {
      provider: 'claude-code',
      externalId: id('claude-pro'),
      email: mail('pro'),
      reportedPlan: 'pro',
      session: 100,
      weekly: 140,
      extraWindows: [
        {
          key: 'seven_day_opus',
          kind: 'weekly_model',
          label: 'Weekly · Opus',
          utilization: 1000,
          resetsAt: hoursFromNow(-3),
          windowMinutes: 10080,
        },
        {
          key: 'brand_new_limit',
          kind: 'other',
          label: 'Brand New Limit',
          utilization: null,
          resetsAt: null,
          windowMinutes: null,
        },
      ],
    },
    {
      provider: 'claude-code',
      externalId: id('claude-stale'),
      email: mail('stale'),
      reportedPlan: 'max',
      status: 'auth_stale',
      message: "Claude Code's access token has expired; it refreshes the next time Claude runs.",
    },
    {
      provider: 'claude-code',
      externalId: id('claude-expired'),
      email: mail('expired'),
      reportedPlan: 'pro',
      status: 'auth_expired',
      message: 'The Claude Code login expired. Run `claude` to sign in.',
    },
    {
      provider: 'claude-code',
      externalId: id('claude-unknown-plan'),
      email: mail('unknownplan'),
      reportedPlan: 'a_plan_from_next_year',
      weeklyResetsIn: null,
    },
    {
      provider: 'claude-code',
      externalId: id('claude-hostile'),
      email: HOSTILE_TEXT,
      organization: HOSTILE_TEXT,
      reportedPlan: HOSTILE_TEXT.slice(0, 80),
      location: HOSTILE_TEXT,
      status: 'error',
      message: HOSTILE_TEXT,
      tokens: [{ model: HOSTILE_TEXT, input: 10 }],
    },
    {
      provider: 'claude-code',
      externalId: id('claude-long'),
      email: `${'e'.repeat(300)}@long.e2e`,
      organization: 'o'.repeat(200),
      reportedPlan: 'p'.repeat(80),
      location: 'l'.repeat(300),
      status: 'error',
      message: 'm'.repeat(500),
    },
    { provider: 'claude-code', externalId: id('claude-nameless'), email: null, status: null },
    {
      provider: 'codex',
      externalId: id('codex-plus'),
      email: mail('plus'),
      reportedPlan: 'plus',
      session: 55,
      weekly: 20,
      weeklyResetsIn: 5,
      tokens: [{ model: 'gpt-5-codex', input: 700_000, output: 30_000 }],
    },
    {
      provider: 'codex',
      externalId: id('codex-limited'),
      email: mail('limited'),
      reportedPlan: 'pro',
      status: 'rate_limited',
      message: 'OpenAI is rate limiting usage requests; try again in a few minutes.',
    },
    {
      provider: 'codex',
      externalId: id('codex-apikey'),
      email: null,
      status: 'no_credentials',
      message: 'This Codex home uses an API key. Only a ChatGPT sign-in has plan limits.',
    },
    {
      provider: 'grok',
      externalId: id('grok-heavy'),
      email: mail('heavy'),
      reportedPlan: 'supergrok_heavy',
      weekly: 64,
    },
    {
      provider: 'grok',
      externalId: id('grok-error'),
      email: mail('grokerror'),
      status: 'error',
      message: 'Could not reach xAI (fetch failed).',
    },
  ];
}

/** Syncs `accounts` as one device would. */
export async function syncFleet(api: APIRequestContext, accounts: FleetAccount[]) {
  return api.post(`${API_URL}/api/v1/accounts/sync`, {
    data: {
      device: { name: 'e2e-fleet', platform: 'linux' },
      accounts: accounts.map(fleetAccount),
    },
  });
}

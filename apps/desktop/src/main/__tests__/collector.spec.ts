import type { CollectorStatus } from '@flama/shared/desktop';
import type {
  SnapshotStatus,
  SyncAccount,
  SyncAccountsInput,
} from '@flama/shared/schemas/accounts';
import type { DetectedLogin } from '@flama/usage-providers';
import { describe, expect, it } from 'vitest';
import { NetworkError, type SyncedAccount, type SyncResult } from '../api-client';
import {
  BACKOFF_MAX_MS,
  backoffDelay,
  Collector,
  type CollectorDeps,
  RATE_LIMIT_PAUSE_MS,
  RENEW_BACKOFF_MS,
  SYNC_INTERVAL_MS,
} from '../collector';
import type { LocalAccount } from '../local-logins';

const LOGIN: DetectedLogin = {
  provider: 'claude-code',
  home: '/h/.claude',
  isDefault: true,
  managed: false,
};

function account(status: SnapshotStatus | null = 'ok'): SyncAccount {
  return {
    provider: 'claude-code',
    externalId: 'acc-1',
    email: 'maya@example.com',
    organization: null,
    reportedPlan: 'max',
    location: LOGIN.home,
    snapshot:
      status === null
        ? null
        : {
            capturedAt: '2026-11-02T12:00:00.000Z',
            source: 'poll',
            status,
            message: null,
            windows: [],
            extraUsage: null,
          },
    dailyTokens: [],
  };
}

function harness(
  opts: {
    token?: string | null;
    results?: Array<SyncResult | Error>;
    readers?: CollectorDeps['readers'];
    renew?: (login: DetectedLogin, sinceDay: string) => Promise<LocalAccount | null>;
  } = {},
) {
  let now = new Date('2026-11-02T12:00:00Z').getTime();
  let token: string | null = opts.token === undefined ? 'tok' : opts.token;
  const results = [...(opts.results ?? [])];
  const timers: Array<{ fn: () => void; ms: number; id: number }> = [];
  const statuses: CollectorStatus[] = [];
  const syncs: SyncAccountsInput[] = [];
  const fetchLimitsAsked: boolean[] = [];
  const applied: SyncedAccount[][] = [];
  const renewCalls: Array<{ home: string; sinceDay: string }> = [];
  let nextAccount: SyncAccount = account();
  let id = 0;

  const deps: CollectorDeps = {
    async read({ fetchLimitsFor }) {
      fetchLimitsAsked.push(fetchLimitsFor(LOGIN));
      return [{ login: LOGIN, account: nextAccount }] satisfies LocalAccount[];
    },
    renew: opts.renew
      ? async (login, sinceDay) => {
          renewCalls.push({ home: login.home, sinceDay });
          return opts.renew?.(login, sinceDay) ?? null;
        }
      : undefined,
    readPointers: async () => ({ 'claude-code': '' }),
    async applyActive(server) {
      applied.push([...server]);
    },
    async sync(input) {
      syncs.push(input);
      const next = results.shift() ?? { kind: 'ok', accounts: [] };
      if (next instanceof Error) throw next;
      return next;
    },
    tokens: {
      get: async () => token,
      set: async (t) => {
        token = t;
      },
    },
    readers: opts.readers,
    device: { name: 'mbp', platform: 'darwin' },
    now: () => new Date(now),
    timers: {
      set: (fn, ms) => {
        id += 1;
        timers.push({ fn, ms, id });
        return id;
      },
      clear: (handle) => {
        const i = timers.findIndex((t) => t.id === handle);
        if (i >= 0) timers.splice(i, 1);
      },
    },
    onStatus: (s) => statuses.push(s),
    onSynced: () => undefined,
    log: () => undefined,
  };
  return {
    collector: new Collector(deps),
    statuses,
    syncs,
    timers,
    fetchLimitsAsked,
    applied,
    advance: (ms: number) => {
      now += ms;
    },
    token: () => token,
    setToken: (t: string | null) => {
      token = t;
    },
    setNextAccount: (a: SyncAccount) => {
      nextAccount = a;
    },
    renewCalls,
  };
}

describe('collector', () => {
  it('syncs, goes idle and schedules the next run in 10 minutes', async () => {
    const h = harness();
    const status = await h.collector.start();
    expect(status.phase).toBe('idle');
    expect(status.lastError).toBeNull();
    expect(status.logins).toEqual([
      expect.objectContaining({ externalId: 'acc-1', active: true, isDefault: true }),
    ]);
    expect(h.syncs[0]?.device).toEqual({ name: 'mbp', platform: 'darwin' });
    expect(h.timers.map((t) => t.ms)).toEqual([SYNC_INTERVAL_MS]);
    expect(h.statuses.map((s) => s.phase)).toEqual(['collecting', 'syncing', 'idle']);
  });

  it('runs the usage readers after a sync and publishes their state, a failure included', async () => {
    const ran: string[] = [];
    const reader = {
      accountId: 'a1',
      provider: 'zai' as const,
      lastReadAt: null,
      status: 'error' as const,
      message: 'down',
    };
    const h = harness({
      readers: {
        async runAll(token) {
          ran.push(token);
          throw new Error('boom');
        },
        states: () => [reader],
      },
    });
    const status = await h.collector.start();
    expect(ran).toEqual(['tok']);
    expect(status.phase).toBe('idle');
    expect(status.readers).toEqual([reader]);
  });

  it('runs no usage reader when the sync did not go through', async () => {
    const ran: string[] = [];
    const h = harness({
      results: [{ kind: 'unauthorized' }],
      readers: { runAll: async (t) => void ran.push(t), states: () => [] },
    });
    await h.collector.start();
    expect(ran).toEqual([]);
  });

  it('on 401 clears the token and goes signed_out without scheduling', async () => {
    const h = harness({ results: [{ kind: 'unauthorized' }] });
    const status = await h.collector.start();
    expect(status.phase).toBe('signed_out');
    expect(h.token()).toBeNull();
    expect(h.timers).toHaveLength(0);
  });

  it('backs off 1m, 2m, 4m … up to 15m on network errors, and resets after a success', async () => {
    const errors = Array.from({ length: 6 }, () => new NetworkError('ECONNREFUSED'));
    const h = harness({ results: [...errors, { kind: 'ok', accounts: [] }] });
    const delays: number[] = [];
    let status = await h.collector.start();
    for (let i = 0; i < 6; i++) {
      expect(status.phase).toBe('error');
      const timer = h.timers.at(-1);
      if (!timer) throw new Error('no timer');
      delays.push(timer.ms);
      h.advance(timer.ms);
      if (i < 5) {
        timer.fn();
        status = await h.collector.refresh(); // joins the run the timer started
      }
    }
    expect(delays).toEqual([60_000, 120_000, 240_000, 480_000, 900_000, 900_000]);
    expect(status.lastError).toContain('Could not reach the ResetOwl API');
    h.timers.at(-1)?.fn();
    expect((await h.collector.refresh()).phase).toBe('idle');
    expect(h.timers.at(-1)?.ms).toBe(SYNC_INTERVAL_MS);
  });

  it('caps the backoff', () => {
    expect(backoffDelay(1)).toBe(60_000);
    expect(backoffDelay(50)).toBe(BACKOFF_MAX_MS);
  });

  it('renews a login read as auth_stale and syncs the fresh reading', async () => {
    const h = harness({ renew: async () => ({ login: LOGIN, account: account('ok') }) });
    h.setNextAccount(account('auth_stale'));
    await h.collector.start();
    expect(h.renewCalls).toEqual([{ home: LOGIN.home, sinceDay: expect.any(String) }]);
    expect(h.syncs[0]?.accounts[0]?.snapshot?.status).toBe('ok');
  });

  it('syncs a login the CLI reports signed out as auth_expired', async () => {
    const h = harness({ renew: async () => ({ login: LOGIN, account: account('auth_expired') }) });
    h.setNextAccount(account('auth_stale'));
    await h.collector.start();
    expect(h.syncs[0]?.accounts[0]?.snapshot?.status).toBe('auth_expired');
  });

  it('does not renew a healthy login', async () => {
    const h = harness({ renew: async () => ({ login: LOGIN, account: account('ok') }) });
    await h.collector.start();
    expect(h.renewCalls).toHaveLength(0);
  });

  it('does not renew while signed out of the API', async () => {
    const h = harness({
      token: null,
      renew: async () => ({ login: LOGIN, account: account('ok') }),
    });
    h.setNextAccount(account('auth_stale'));
    await h.collector.start();
    expect(h.renewCalls).toHaveLength(0);
  });

  it('keeps the stale reading and backs off when renewal is unavailable', async () => {
    const h = harness({ renew: async () => null });
    h.setNextAccount(account('auth_stale'));
    await h.collector.start();
    expect(h.renewCalls).toHaveLength(1);
    expect(h.syncs[0]?.accounts[0]?.snapshot?.status).toBe('auth_stale');

    // The scheduled run inside the renew backoff does not try again…
    const scheduled = h.timers.at(-1);
    if (!scheduled) throw new Error('no timer');
    h.advance(scheduled.ms);
    scheduled.fn();
    await h.collector.refresh();
    expect(h.renewCalls).toHaveLength(1);

    // …but once the backoff has passed, the next run renews again.
    const next = h.timers.at(-1);
    if (!next) throw new Error('no timer');
    h.advance(RENEW_BACKOFF_MS);
    next.fn();
    await h.collector.refresh();
    expect(h.renewCalls).toHaveLength(2);
  });

  it('debounces refresh to once a minute', async () => {
    const h = harness();
    await h.collector.start();
    h.advance(30_000);
    await h.collector.refresh();
    expect(h.syncs).toHaveLength(1);
    h.advance(31_000);
    await h.collector.refresh();
    expect(h.syncs).toHaveLength(2);
  });

  it('without a token reads logins locally, never fetches limits and never syncs', async () => {
    const h = harness({ token: null });
    const status = await h.collector.start();
    expect(status.phase).toBe('signed_out');
    expect(status.logins).toHaveLength(1);
    expect(h.fetchLimitsAsked).toEqual([false]);
    expect(h.syncs).toHaveLength(0);
  });

  it('a new token syncs at once, past the debounce', async () => {
    const h = harness({ token: null });
    await h.collector.start();
    h.setToken('fresh');
    const status = await h.collector.tokenChanged('fresh');
    expect(status.phase).toBe('idle');
    expect(h.syncs).toHaveLength(1);
  });

  // The first run reads the token store before the sign-in lands; joining it
  // would leave the app signed out until a manual refresh.
  it('a sign-in during a run syncs once that run has finished', async () => {
    const h = harness({ token: null });
    const first = h.collector.start();
    h.setToken('fresh');
    const status = await h.collector.tokenChanged('fresh');
    expect((await first).phase).toBe('signed_out');
    expect(status.phase).toBe('idle');
    expect(h.syncs).toHaveLength(1);
  });

  // A run under way read the disk before the new login was there; joining it
  // would answer "Account added" with the account still off the API.
  it('runNow during a run syncs again once that run has finished', async () => {
    const h = harness();
    const first = h.collector.start();
    const status = await h.collector.runNow();
    await first;
    expect(status.phase).toBe('idle');
    expect(h.syncs).toHaveLength(2);
  });

  it('skips limit fetching for a rate-limited login for 15 minutes', async () => {
    const h = harness();
    h.setNextAccount(account('rate_limited'));
    await h.collector.start();
    h.setNextAccount(account(null));
    h.advance(61_000);
    await h.collector.refresh();
    h.advance(RATE_LIMIT_PAUSE_MS);
    await h.collector.refresh();
    expect(h.fetchLimitsAsked).toEqual([true, false, true]);
  });

  it('applies the server active flags after a successful sync', async () => {
    const server: SyncedAccount = {
      id: 'x',
      provider: 'claude-code',
      externalId: 'acc-1',
      displayName: 'Maya',
      isActive: true,
      latest: null,
    };
    const h = harness({ results: [{ kind: 'ok', accounts: [server] }] });
    await h.collector.start();
    expect(h.applied).toEqual([[server]]);
  });

  it('sends a live snapshot with no tokens, at most once a minute per login', async () => {
    const h = harness();
    await h.collector.start();
    const windows = [
      {
        key: 'five_hour',
        kind: 'session' as const,
        label: 'Session',
        utilization: 12,
        resetsAt: null,
        windowMinutes: 300,
      },
    ];
    expect(await h.collector.sendLive('/h/.claude', windows)).toBe(true);
    expect(await h.collector.sendLive('/h/.claude', windows)).toBe(false);
    expect(await h.collector.sendLive('/elsewhere', windows)).toBe(false);
    const live = h.syncs.at(-1)?.accounts[0];
    expect(live?.snapshot).toMatchObject({ source: 'live', status: 'ok', windows });
    expect(live?.dailyTokens).toEqual([]);
    h.advance(60_000);
    expect(await h.collector.sendLive('/h/.claude', windows)).toBe(true);
  });
});

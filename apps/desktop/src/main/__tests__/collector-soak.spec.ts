import type { CollectorStatus } from '@flama/shared/desktop';
import { syncAccountsSchema } from '@flama/shared/schemas/accounts';
import {
  claudeUsageBody,
  codexUsageBody,
  FakeMachine,
  FakeVendors,
  grokBillingBody,
  HOSTILE_BODIES,
  type MachineLogin,
  type Reply,
  reply,
  type VendorId,
} from '@flama/usage-providers/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { postSync } from '../api-client';
import { BACKOFF_MAX_MS, Collector, RATE_LIMIT_PAUSE_MS, SYNC_INTERVAL_MS } from '../collector';
import { readLocalAccounts } from '../local-logins';

/**
 * The collector as the app runs it — the real providers reading a machine on
 * disk, the real API client — driven for days of simulated time while the
 * vendors and the API fail at random. What is protected are the promises that
 * must hold in every order of events, which a test of one scenario cannot
 * show: nothing sent to the API is refused by its contract or carries a
 * credential, a login a vendor rate limited is left alone for 15 minutes, the
 * collector always has exactly one next run planned (or none, signed out),
 * and it never waits longer than its backoff cap. A seed that breaks one is
 * printed with the failure; add it to `SEEDS` to keep it.
 */

const API = 'https://api.resetowl.test';
const API_TOKEN = 'api-bearer-token-never-logged';
const YEAR = 365 * 24 * 3_600_000;
const SEEDS = (process.env.SOAK_SEEDS ?? '1,2,3,7,42,1337,20261102,987654321')
  .split(',')
  .map(Number);
const STEPS = Number(process.env.SOAK_STEPS ?? 250);

/** A small seeded generator (mulberry32): the same seed is the same run. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (max: number) => Math.floor(next() * max),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    chance: (p: number) => next() < p,
  };
}

const VENDOR_OF: Record<MachineLogin['provider'], VendorId> = {
  'claude-code': 'anthropic',
  codex: 'openai',
  grok: 'xai',
};

function healthyBody(login: MachineLogin, used: number): unknown {
  if (login.provider === 'claude-code') return claudeUsageBody({ session: used, weekly: used / 2 });
  if (login.provider === 'codex') return codexUsageBody({ session: used, weekly: used / 2 });
  return grokBillingBody({ weekly: used });
}

const machines: FakeMachine[] = [];
afterEach(async () => {
  await Promise.all(machines.splice(0).map((machine) => machine.dispose()));
});

async function soak(seed: number) {
  const random = rng(seed);
  let now = new Date('2026-11-02T12:00:00Z').getTime();
  const machine = await FakeMachine.create({ now: () => new Date(now) });
  machines.push(machine);
  const used = [{ input: 1_000, output: 100 }];
  await machine.claude({ name: 'home', validFor: YEAR, used });
  await machine.claude({ name: 'work', dir: 'work', validFor: YEAR, used });
  await machine.codex({ name: 'home', used });
  await machine.grok({ name: 'home', validFor: YEAR });
  const vendors = new FakeVendors();
  const problems: string[] = [];
  const problem = (text: string) => problems.push(`seed ${seed}: ${text}`);

  // What each vendor answers next, and since when a login must be left alone.
  const leftAloneUntil = new Map<string, number>();
  const answering = new Map<string, Reply>();
  const rescript = () => {
    for (const login of machine.logins) {
      const roll = random.next();
      const next: Reply =
        roll < 0.5
          ? reply.json(healthyBody(login, random.int(100)))
          : roll < 0.65
            ? reply.status(429)
            : roll < 0.75
              ? reply.status(random.pick([401, 403, 500, 502, 503]))
              : roll < 0.85
                ? random.pick([reply.network(), reply.timeout(), reply.text('<html>')])
                : reply.json(random.pick(HOSTILE_BODIES).body);
      answering.set(login.credential, next);
      vendors.set(VENDOR_OF[login.provider], login.credential, next);
    }
  };

  let apiMode: 'ok' | 'down' | 'broken' | 'unauthorized' = 'ok';
  let token: string | null = API_TOKEN;
  let syncs = 0;
  const logs: string[] = [];
  const statuses: CollectorStatus[] = [];
  const timers: Array<{ fn: () => void; ms: number; id: number }> = [];
  let timerId = 0;

  /** The network as the main process sees it: the vendors and the API, nothing else. */
  const network: typeof fetch = async (input, init) => {
    const url = String(input);
    if (!url.startsWith(API)) {
      const headers = new Headers(init?.headers);
      const credential = (headers.get('authorization') ?? '').replace(/^Bearer /, '');
      if ((leftAloneUntil.get(credential) ?? 0) > now) {
        problem(`asked a vendor about a rate limited login ${url} before its pause ended`);
      }
      if (token === null) problem(`asked a vendor while signed out: ${url}`);
      if (credential === API_TOKEN) problem(`sent the API token to a vendor: ${url}`);
      const answer = answering.get(credential);
      if (answer?.kind === 'json' && answer.status === 429) {
        leftAloneUntil.set(credential, now + RATE_LIMIT_PAUSE_MS);
      }
      return vendors.fetch(input, init);
    }
    syncs += 1;
    const body = String(init?.body ?? '');
    for (const credential of machine.credentials) {
      if (body.includes(credential)) problem('a credential was sent to the API');
    }
    const headers = new Headers(init?.headers);
    if (headers.get('authorization') !== `Bearer ${API_TOKEN}`) problem('synced without the token');
    const parsed = syncAccountsSchema.safeParse(JSON.parse(body));
    if (!parsed.success) {
      problem(`the API would refuse the sync: ${JSON.stringify(parsed.error.issues.slice(0, 2))}`);
    }
    if (apiMode === 'down') throw new TypeError('fetch failed');
    if (apiMode === 'unauthorized') return new Response('{}', { status: 401 });
    if (apiMode === 'broken') {
      return new Response(JSON.stringify({ title: 'Internal error' }), { status: 500 });
    }
    return new Response('[]', { status: 200 });
  };

  const env = machine.env({ fetch: network });
  const collector = new Collector({
    read: (opts) => readLocalAccounts(env, opts),
    readPointers: async () => ({}),
    applyActive: async () => undefined,
    sync: (input, bearer) =>
      postSync({
        apiUrl: API,
        token: bearer,
        input,
        userAgent: 'resetowl-desktop/test',
        fetch: network,
      }),
    tokens: {
      get: async () => token,
      set: async (next) => {
        token = next;
      },
    },
    device: { name: 'soak', platform: 'linux' },
    now: () => new Date(now),
    timers: {
      set: (fn, ms) => {
        timerId += 1;
        timers.push({ fn, ms, id: timerId });
        return timerId;
      },
      clear: (handle) => {
        const index = timers.findIndex((timer) => timer.id === handle);
        if (index >= 0) timers.splice(index, 1);
      },
    },
    onStatus: (status) => statuses.push(status),
    onSynced: () => undefined,
    log: (line) => logs.push(line),
  });

  /** What must be true whenever the collector is at rest. */
  const check = (after: string) => {
    const status = collector.status();
    if (timers.length > 1) problem(`${timers.length} runs planned after ${after}`);
    if (status.phase === 'collecting' || status.phase === 'syncing') {
      problem(`still ${status.phase} at rest after ${after}`);
    }
    if (status.phase === 'signed_out') {
      if (timers.length !== 0) problem(`a run planned while signed out after ${after}`);
    } else if (timers.length !== 1) {
      problem(`no next run planned in phase ${status.phase} after ${after}`);
    }
    const planned = timers[0]?.ms ?? 0;
    if (planned > BACKOFF_MAX_MS) problem(`a ${planned}ms wait after ${after}`);
    if (status.phase === 'idle' && planned !== SYNC_INTERVAL_MS) {
      problem(`idle with the next run in ${planned}ms after ${after}`);
    }
    if (status.logins.length !== machine.logins.length) {
      problem(`${status.logins.length} logins shown after ${after}`);
    }
  };

  let outage = 0;
  rescript();
  await collector.start();
  check('start');
  for (let step = 0; step < STEPS; step++) {
    rescript();
    // Now and then the API is down for a stretch, long enough to reach the backoff's cap.
    if (outage === 0 && random.chance(0.04)) outage = 12;
    if (outage > 0) outage -= 1;
    apiMode =
      outage > 0
        ? 'down'
        : random.pick(['ok', 'ok', 'ok', 'ok', 'down', 'broken', 'unauthorized'] as const);
    const action = random.int(10);
    let name: string;
    if (action < 5 && timers[0]) {
      // The planned run comes due.
      const timer = timers.shift() as { fn: () => void; ms: number };
      now += timer.ms;
      name = 'the planned run';
      timer.fn();
      // The timer starts a run it does not hand back; joining it is `runNow`'s first branch.
      await collector.refresh();
    } else if (action < 7) {
      now += random.int(180_000);
      name = 'refresh';
      await collector.refresh();
    } else if (action < 8) {
      now += random.int(60_000);
      name = 'runNow';
      await Promise.all([collector.runNow(), collector.refresh(), collector.runNow()]);
    } else if (action < 9) {
      name = 'a live reading';
      const home = random.pick(machine.logins).login.home;
      await collector.sendLive(home, [
        {
          key: 'five_hour',
          kind: 'session',
          label: 'Session (5h)',
          utilization: random.int(100),
          resetsAt: null,
          windowMinutes: 300,
        },
      ]);
    } else {
      name = token ? 'sign-out' : 'sign-in';
      token = token ? null : API_TOKEN;
      await collector.tokenChanged(token);
    }
    // A 401 from the API signs the app out; the person signs back in.
    if (token === null && random.chance(0.6)) {
      apiMode = 'ok';
      token = API_TOKEN;
      await collector.tokenChanged(token);
      name += ', then sign-in';
    }
    check(name);
    if (problems.length > 0) break;
  }

  const said = JSON.stringify([statuses, logs]);
  for (const credential of machine.credentials) {
    if (said.includes(credential)) problem('a credential reached a status or a log line');
  }
  if (said.includes(API_TOKEN)) problem('the API token reached a status or a log line');
  for (const line of vendors.audit({ userAgent: /^resetowl-desktop\// })) problem(line);
  return { problems, syncs, vendorRequests: vendors.requests.length };
}

describe('the collector over days of failing vendors and a failing API', () => {
  for (const seed of SEEDS) {
    it(`keeps every promise (seed ${seed})`, async () => {
      const result = await soak(seed);
      expect(result.problems).toEqual([]);
      // The run did real work: it is not green because nothing happened.
      expect(result.syncs).toBeGreaterThan(50);
      expect(result.vendorRequests).toBeGreaterThan(100);
    });
  }
});

import {
  type SnapshotStatus,
  syncAccountSchema,
  usageSnapshotSchema,
} from '@flama/shared/schemas/accounts';
import { afterEach, describe, expect, it } from 'vitest';
import { collectAll } from '../../collect';
import {
  claudeUsageBody,
  codexUsageBody,
  FakeMachine,
  FakeVendors,
  grokBillingBody,
  HOSTILE_BODIES,
  type Reply,
  reply,
  type VendorId,
  zaiQuotaBody,
} from '../../testing';
import { readZaiQuota } from '../../zai/quota';

/**
 * Every vendor failing in every way it can, against every reader. What is
 * protected: a vendor having a bad day never fails a sync, never produces a
 * reading the API would refuse, and never moves a credential anywhere but to
 * the vendor that issued it. A reader that throws, or that maps a failure to
 * the wrong status (so the screens say "sign in again" for an outage), fails
 * here.
 */

const NOW = new Date('2026-11-02T12:00:00Z');
const opts = { sinceDay: '2026-10-26', fetchLimits: true };
const ZAI_KEY = 'zai-key.0123456789abcdef';

type Reader = 'claude-code' | 'codex' | 'grok' | 'zai';
const VENDOR_OF: Record<Reader, VendorId> = {
  'claude-code': 'anthropic',
  codex: 'openai',
  grok: 'xai',
  zai: 'zai',
};

/** How each vendor failure must read, per reader. */
const FAILURES: ReadonlyArray<{
  name: string;
  reply: Reply;
  expected: Record<Reader, SnapshotStatus>;
}> = [
  {
    name: 'a 401',
    reply: reply.status(401),
    // The Claude login holds a refresh token, so its own CLI can renew it.
    expected: {
      'claude-code': 'auth_stale',
      codex: 'auth_expired',
      grok: 'auth_expired',
      zai: 'auth_expired',
    },
  },
  {
    name: 'a 403',
    reply: reply.status(403),
    expected: {
      'claude-code': 'auth_stale',
      codex: 'auth_expired',
      grok: 'auth_expired',
      zai: 'auth_expired',
    },
  },
  ...[
    ['a 429', reply.status(429), 'rate_limited'] as const,
    ['a 500', reply.status(500), 'error'] as const,
    ['a 502 with an HTML page', reply.text('<html>Bad gateway</html>', 502), 'error'] as const,
    ['a 503', reply.status(503), 'error'] as const,
    ['a 404', reply.status(404), 'error'] as const,
    ['a connection that fails', reply.network(), 'error'] as const,
    ['a request that times out', reply.timeout(), 'error'] as const,
    [
      'a 200 that is an HTML page',
      reply.text('<!doctype html><title>Login</title>'),
      'error',
    ] as const,
    ['a 200 with no body', reply.text('', 200, 'application/json'), 'error'] as const,
    [
      'a 200 cut off mid-answer',
      reply.text('{"five_hour":{"utiliz', 200, 'application/json'),
      'error',
    ] as const,
    ['a 204', reply.text('', 204, 'application/json'), 'error'] as const,
  ].map(([name, answer, status]) => ({
    name,
    reply: answer,
    expected: { 'claude-code': status, codex: status, grok: status, zai: status },
  })),
];

const machines: FakeMachine[] = [];
afterEach(async () => {
  await Promise.all(machines.splice(0).map((machine) => machine.dispose()));
});

/** One login of each provider, each with tokens on disk where the provider counts them. */
async function machine() {
  const m = await FakeMachine.create({ now: NOW });
  machines.push(m);
  const used = [{ model: 'claude-sonnet-4-5', input: 1_000, output: 200 }];
  const claude = await m.claude({ name: 'maya', used });
  const codex = await m.codex({ name: 'maya', used: [{ model: 'gpt-5-codex', input: 900 }] });
  const grok = await m.grok({ name: 'maya' });
  return { m, logins: { 'claude-code': claude, codex, grok } };
}

function healthy(vendors: FakeVendors, credentials: Record<Exclude<Reader, 'zai'>, string>) {
  vendors
    .set('anthropic', credentials['claude-code'], reply.json(claudeUsageBody()))
    .set('openai', credentials.codex, reply.json(codexUsageBody()))
    .set('xai', credentials.grok, reply.json(grokBillingBody()));
}

describe('a vendor failing', () => {
  for (const failure of FAILURES) {
    for (const reader of ['claude-code', 'codex', 'grok'] as const) {
      it(`${failure.name} from ${VENDOR_OF[reader]} reads as ${failure.expected[reader]}, and the others still read`, async () => {
        const { m, logins } = await machine();
        const vendors = new FakeVendors();
        healthy(vendors, {
          'claude-code': logins['claude-code'].credential,
          codex: logins.codex.credential,
          grok: logins.grok.credential,
        });
        vendors.set(VENDOR_OF[reader], logins[reader].credential, failure.reply);

        const collected = await collectAll(m.env({ fetch: vendors.fetch }), opts);

        expect(collected.map((c) => c.account.provider)).toEqual(['claude-code', 'codex', 'grok']);
        for (const { account } of collected) {
          expect(syncAccountSchema.parse(account)).toEqual(account);
          const expected = account.provider === reader ? failure.expected[reader] : 'ok';
          expect(account.snapshot?.status, account.snapshot?.message ?? '').toBe(expected);
          // Who it is and what it used come from disk, whatever the vendor says.
          expect(account.externalId).toBe(logins[account.provider].externalId);
          expect(account.email).toBe(logins[account.provider].email);
        }
        expect(collected[0]?.account.dailyTokens).toHaveLength(1);
        expect(collected[1]?.account.dailyTokens).toHaveLength(1);
        const sent = JSON.stringify(collected);
        for (const credential of m.credentials) expect(sent).not.toContain(credential);
        expect(vendors.audit()).toEqual([]);
        // One question per login: a failure is not retried in a loop.
        expect(vendors.requests).toHaveLength(3);
      });
    }

    it(`${failure.name} from zai reads as ${failure.expected.zai}`, async () => {
      const vendors = new FakeVendors().set('zai', ZAI_KEY, failure.reply);
      const reading = await readZaiQuota(
        { fetch: vendors.fetch, userAgent: 'resetowl-desktop/test', now: () => NOW },
        { provider: 'zai', apiKey: ZAI_KEY },
      );
      expect(reading.status).toBe(failure.expected.zai);
      expect(reading.snapshot).toBeNull();
      expect(JSON.stringify(reading)).not.toContain(ZAI_KEY);
      expect(vendors.audit()).toEqual([]);
      expect(vendors.requests).toHaveLength(1);
    });
  }
});

describe('a vendor answering 200 with something else', () => {
  for (const hostile of HOSTILE_BODIES) {
    it(`${hostile.name}: every reader still gives a reading the contract accepts`, async () => {
      const { m, logins } = await machine();
      const vendors = new FakeVendors()
        .set('anthropic', logins['claude-code'].credential, reply.json(hostile.body))
        .set('openai', logins.codex.credential, reply.json(hostile.body))
        .set('xai', logins.grok.credential, reply.json(hostile.body))
        .set('zai', ZAI_KEY, reply.json(hostile.body));

      const collected = await collectAll(m.env({ fetch: vendors.fetch }), opts);
      expect(collected).toHaveLength(3);
      for (const { account } of collected) {
        expect(syncAccountSchema.parse(account)).toEqual(account);
        expect(account.externalId).toBe(logins[account.provider].externalId);
      }

      const reading = await readZaiQuota(
        { fetch: vendors.fetch, userAgent: 'resetowl-desktop/test', now: () => NOW },
        { provider: 'zai', apiKey: ZAI_KEY },
      );
      if (reading.snapshot) {
        expect(usageSnapshotSchema.parse(reading.snapshot)).toEqual(reading.snapshot);
      } else {
        expect(reading.status).toBe('error');
      }
      expect((reading.message ?? '').length).toBeLessThanOrEqual(500);
      expect(vendors.audit()).toEqual([]);
    });
  }
});

describe('the fakes themselves', () => {
  it('a healthy machine reads ok everywhere, each credential only at its own vendor', async () => {
    const { m, logins } = await machine();
    const vendors = new FakeVendors().set('zai', ZAI_KEY, reply.json(zaiQuotaBody()));
    healthy(vendors, {
      'claude-code': logins['claude-code'].credential,
      codex: logins.codex.credential,
      grok: logins.grok.credential,
    });

    const collected = await collectAll(m.env({ fetch: vendors.fetch }), opts);
    expect(collected.map((c) => c.account.snapshot?.status)).toEqual(['ok', 'ok', 'ok']);
    expect(collected.map((c) => c.account.snapshot?.windows.map((w) => w.kind))).toEqual([
      ['session', 'weekly'],
      ['session', 'weekly'],
      ['weekly'],
    ]);
    expect(vendors.requestsTo('anthropic').map((r) => r.credential)).toEqual([
      logins['claude-code'].credential,
    ]);
    expect(vendors.requestsTo('openai').map((r) => r.credential)).toEqual([
      logins.codex.credential,
    ]);
    expect(vendors.requestsTo('xai').map((r) => r.credential)).toEqual([logins.grok.credential]);
  });

  it('the audit names a credential sent to another vendor, a borrowed client name and a stray host', async () => {
    const vendors = new FakeVendors().set('anthropic', 'claude-secret', reply.json({}));
    await vendors.fetch('https://chatgpt.com/backend-api/wham/usage', {
      headers: {
        Authorization: 'Bearer claude-secret',
        'User-Agent': 'codex_cli_rs/1.0',
        originator: 'codex_cli_rs',
      },
    });
    await vendors
      .fetch('https://telemetry.example/collect', {
        method: 'POST',
        headers: { Authorization: 'Bearer claude-secret' },
      })
      .catch(() => undefined);

    expect(vendors.audit()).toEqual([
      'GET https://chatgpt.com/backend-api/wham/usage: User-Agent "codex_cli_rs/1.0" is not ours',
      'GET https://chatgpt.com/backend-api/wham/usage: sends the vendor client header "originator"',
      'GET https://chatgpt.com/backend-api/wham/usage: carries a credential issued by anthropic',
      'POST https://telemetry.example/collect: not a vendor usage endpoint',
      'POST https://telemetry.example/collect: carries a credential issued by anthropic',
    ]);
  });

  it('a script plays its replies in order and repeats the last', async () => {
    const vendors = new FakeVendors().set(
      'xai',
      'session',
      reply.status(429),
      reply.json(grokBillingBody({ weekly: 5 })),
    );
    const ask = () =>
      vendors.fetch('https://cli-chat-proxy.grok.com/v1/billing?format=credits', {
        headers: { Authorization: 'Bearer session' },
      });
    expect((await ask()).status).toBe(429);
    expect((await ask()).status).toBe(200);
    expect((await ask()).status).toBe(200);
    // A token the vendor never issued is refused, as a real one would be.
    const stranger = await vendors.fetch('https://cli-chat-proxy.grok.com/v1/billing', {
      headers: { Authorization: 'Bearer someone-else' },
    });
    expect(stranger.status).toBe(401);
  });
});

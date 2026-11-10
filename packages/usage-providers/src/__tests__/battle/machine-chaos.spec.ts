import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type SnapshotStatus, syncAccountSchema } from '@flama/shared/schemas/accounts';
import { afterEach, describe, expect, it } from 'vitest';
import { collectAll } from '../../collect';
import {
  claudeAssistantLine,
  claudeUsageBody,
  codexUsageBody,
  FakeMachine,
  FakeVendors,
  grokBillingBody,
  jsonl,
  reply,
  type TokenState,
  writeJson,
  writeText,
} from '../../testing';

/**
 * The machine itself in a bad state: many logins, logins in every stage of
 * their life, and homes whose files are broken. What is protected: reading a
 * machine never throws, one unreadable folder never hides the logins beside
 * it, a login that cannot be asked about is not asked about, and everything
 * collected is something the API accepts.
 */

const NOW = new Date('2026-11-02T12:00:00Z');
const opts = { sinceDay: '2026-10-26', fetchLimits: true };

const machines: FakeMachine[] = [];
afterEach(async () => {
  await Promise.all(machines.splice(0).map((machine) => machine.dispose()));
});

async function newMachine() {
  const machine = await FakeMachine.create({ now: NOW });
  machines.push(machine);
  return machine;
}

/** Every vendor answering every login on the machine with a healthy reading. */
function allHealthy(machine: FakeMachine): FakeVendors {
  const vendors = new FakeVendors();
  for (const login of machine.logins) {
    if (login.provider === 'claude-code') {
      vendors.set('anthropic', login.credential, reply.json(claudeUsageBody()));
    } else if (login.provider === 'codex') {
      vendors.set('openai', login.credential, reply.json(codexUsageBody()));
    } else {
      vendors.set('xai', login.credential, reply.json(grokBillingBody()));
    }
  }
  return vendors;
}

describe('a machine with many logins', () => {
  it('reads twelve logins across three providers, one row each, every credential only at its vendor', async () => {
    const machine = await newMachine();
    const used = [{ model: 'claude-opus-4-1', input: 5_000, output: 700, cacheRead: 90_000 }];
    await machine.claude({ name: 'home', subscriptionType: 'max', used });
    for (const dir of ['work', 'client', 'side']) {
      await machine.claude({ name: dir, dir, used });
    }
    for (const id of ['m1', 'm2']) await machine.claude({ name: id, managed: id, used });
    await machine.codex({ name: 'home', plan: 'pro', used: [{ input: 2_000, output: 100 }] });
    for (const id of ['c1', 'c2']) await machine.codex({ name: id, managed: id });
    await machine.grok({ name: 'home' });
    for (const id of ['g1', 'g2']) await machine.grok({ name: id, managed: id });
    const vendors = allHealthy(machine);

    const collected = await collectAll(machine.env({ fetch: vendors.fetch }), opts);

    expect(collected).toHaveLength(12);
    expect(collected.map((c) => c.account.externalId).sort()).toEqual(
      machine.logins.map((login) => login.externalId).sort(),
    );
    for (const { account } of collected) {
      expect(syncAccountSchema.parse(account)).toEqual(account);
      expect(account.snapshot?.status).toBe('ok');
    }
    expect(collected.filter((c) => c.login.isDefault).map((c) => c.account.provider)).toEqual([
      'claude-code',
      'codex',
      'grok',
    ]);
    expect(vendors.requests).toHaveLength(12);
    expect(new Set(vendors.requests.map((r) => r.credential)).size).toBe(12);
    expect(vendors.audit()).toEqual([]);
    const sent = JSON.stringify(collected);
    for (const credential of machine.credentials) expect(sent).not.toContain(credential);
  });

  it('keeps the default login when one account is signed in three times', async () => {
    const machine = await newMachine();
    const email = 'same@claude.test';
    const first = await machine.claude({ name: 'same', email });
    // The same account again: `name` gives the account its id, the folder differs.
    const second = await machine.claude({ name: 'same', email, dir: 'copy' });
    const third = await machine.claude({ name: 'same', email, managed: 'copy' });
    const vendors = allHealthy(machine);

    const collected = await collectAll(machine.env({ fetch: vendors.fetch }), opts);

    expect(collected).toHaveLength(1);
    expect(collected[0]?.login.home).toBe(first.login.home);
    expect([second.login.home, third.login.home]).not.toContain(collected[0]?.login.home);
  });
});

describe('a login in each stage of its life', () => {
  const EXPECTED: Record<string, Record<TokenState, SnapshotStatus>> = {
    'claude-code': {
      valid: 'ok',
      renewable: 'auth_stale',
      lapsed: 'auth_expired',
      none: 'no_credentials',
    },
    codex: {
      valid: 'ok',
      renewable: 'no_credentials',
      lapsed: 'no_credentials',
      none: 'no_credentials',
    },
    grok: {
      valid: 'ok',
      renewable: 'auth_expired',
      lapsed: 'auth_expired',
      none: 'no_credentials',
    },
  };

  for (const token of ['valid', 'renewable', 'lapsed', 'none'] as const) {
    it(`${token}: each provider says so, and only a valid login is asked about`, async () => {
      const machine = await newMachine();
      await machine.claude({ name: 'maya', token });
      await machine.codex({ name: 'maya', token, used: [{ input: 10 }] });
      await machine.grok({ name: 'maya', token });
      const vendors = allHealthy(machine);

      const collected = await collectAll(machine.env({ fetch: vendors.fetch }), opts);

      expect(collected.map((c) => [c.account.provider, c.account.snapshot?.status])).toEqual([
        ['claude-code', EXPECTED['claude-code']?.[token]],
        ['codex', EXPECTED.codex?.[token]],
        ['grok', EXPECTED.grok?.[token]],
      ]);
      for (const { account } of collected) {
        expect(syncAccountSchema.parse(account)).toEqual(account);
      }
      // A lapsed token would only be refused, and asking spends the vendor's patience.
      expect(vendors.requests).toHaveLength(token === 'valid' ? 3 : 0);
    });
  }

  it('reads identity, plan and tokens with limits off, and asks nobody', async () => {
    const machine = await newMachine();
    await machine.claude({ name: 'maya', rateLimitTier: 'default_claude_max_20x', used: [{}] });
    await machine.codex({ name: 'maya', plan: 'pro', used: [{ input: 10 }] });
    await machine.grok({ name: 'maya' });
    const vendors = allHealthy(machine);

    const collected = await collectAll(machine.env({ fetch: vendors.fetch }), {
      ...opts,
      fetchLimits: false,
    });

    expect(collected.map((c) => c.account.snapshot)).toEqual([null, null, null]);
    expect(collected.map((c) => c.account.reportedPlan)).toEqual([
      'default_claude_max_20x',
      'pro',
      null,
    ]);
    expect(collected.map((c) => c.account.dailyTokens.length)).toEqual([1, 1, 0]);
    expect(vendors.requests).toEqual([]);
  });
});

describe('homes whose files are broken', () => {
  it('reads the healthy logins beside every kind of broken one', async () => {
    const machine = await newMachine();
    const healthy = await machine.claude({ name: 'healthy', used: [{ input: 100 }] });
    const home = machine.home;

    // Login files that are not what they should be.
    await mkdir(join(home, '.claude-dir-for-file', '.credentials.json'), { recursive: true });
    await writeText(join(home, '.claude-truncated', '.credentials.json'), '{"claudeAiOauth":{"acc');
    await writeText(join(home, '.claude-truncated', '.claude.json'), '{"oauthAccount":');
    await writeFile(join(home, '.claude-binary'), Buffer.from([0, 255, 254, 0]));
    await writeText(join(home, '.claude-empty', '.credentials.json'), '');
    await writeText(join(home, '.claude-empty', '.claude.json'), '');
    await writeJson(join(home, '.claude-array', '.credentials.json'), [1, 2, 3]);
    await writeJson(join(home, '.claude-array', '.claude.json'), 'oauthAccount');
    await writeJson(join(home, '.claude-wrongtypes', '.credentials.json'), {
      claudeAiOauth: { accessToken: 12345, expiresAt: 'soon', subscriptionType: ['max'] },
    });
    await writeJson(join(home, '.claude-wrongtypes', '.claude.json'), {
      oauthAccount: { accountUuid: { id: 1 }, emailAddress: 42, organizationName: null },
    });
    // A login whose identity is longer than any column.
    await writeJson(join(home, '.claude-long', '.credentials.json'), {
      claudeAiOauth: {
        accessToken: 'long-token',
        expiresAt: NOW.getTime() + 3_600_000,
        subscriptionType: 'p'.repeat(500),
      },
    });
    await writeJson(join(home, '.claude-long', '.claude.json'), {
      oauthAccount: {
        accountUuid: 'u'.repeat(1_000),
        emailAddress: `${'e'.repeat(1_000)}@example.com`,
        organizationName: 'o'.repeat(1_000),
      },
    });
    await writeJson(join(machine.managedRoot, 'codex', 'array', 'auth.json'), []);
    await writeText(join(machine.managedRoot, 'codex', 'garbage', 'auth.json'), '\u0000\u0001');
    await writeJson(join(machine.managedRoot, 'codex', 'badjwt', 'auth.json'), {
      tokens: { id_token: 'not.a.jwt', access_token: 'bad-jwt-token' },
    });
    await writeJson(join(machine.managedRoot, 'grok', 'wrong', 'auth.json'), {
      'https://accounts.x.ai/sign-in': { key: 7, expires_at: 'never' },
    });
    const vendors = allHealthy(machine).set(
      'anthropic',
      'long-token',
      reply.json(claudeUsageBody()),
    );

    const collected = await collectAll(machine.env({ fetch: vendors.fetch }), opts);

    const mine = collected.find((c) => c.account.externalId === healthy.externalId);
    expect(mine?.account.snapshot?.status).toBe('ok');
    expect(mine?.account.dailyTokens).toHaveLength(1);
    for (const { account } of collected) {
      const parsed = syncAccountSchema.safeParse(account);
      expect(parsed.error?.issues ?? [], account.location ?? '').toEqual([]);
    }
    // Each folder is its own row: none was merged into another or dropped the rest.
    expect(new Set(collected.map((c) => c.login.home)).size).toBe(collected.length);
    expect(collected.length).toBeGreaterThanOrEqual(8);
    expect(vendors.audit()).toEqual([]);
  });

  it('counts the good lines of a transcript full of bad ones, and survives a link loop', async () => {
    const machine = await newMachine();
    const login = await machine.claude({ name: 'maya' });
    const projects = join(login.login.home, 'projects');
    const ts = '2026-11-02T09:00:00Z';
    const good = (id: string) =>
      JSON.stringify(claudeAssistantLine({ ts, id, requestId: id, input: 100, output: 10 }));
    await writeText(
      join(projects, 'p', 'mixed.jsonl'),
      [
        good('a'),
        '',
        '{"usage"',
        'not json at all "usage"',
        JSON.stringify({ type: 'assistant', timestamp: ts, message: { usage: null } }),
        JSON.stringify({ type: 'assistant', timestamp: 'never', message: { usage: {} } }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '+275760-09-13T00:00:00.000Z',
          message: { model: 'far-future', usage: { input_tokens: 5 } },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: ts,
          message: {
            id: 'huge',
            model: 'm'.repeat(500),
            usage: { input_tokens: 1e308, output_tokens: -50, cache_read_input_tokens: '7' },
          },
        }),
        `{"usage":"${'x'.repeat(2_000_000)}"}`,
        good('b'),
        // The same turn again, as a resumed session writes it.
        good('b'),
      ].join('\n'),
    );
    await writeFile(join(projects, 'p', 'binary.jsonl'), Buffer.alloc(4096, 255));
    await mkdir(join(projects, 'p', 'folder.jsonl'), { recursive: true });
    await symlink(projects, join(projects, 'p', 'loop'));
    await writeText(join(projects, 'q', 'second.jsonl'), jsonl(JSON.parse(good('c'))));

    const vendors = allHealthy(machine);
    const [item] = await collectAll(machine.env({ fetch: vendors.fetch }), opts);

    expect(syncAccountSchema.parse(item?.account)).toEqual(item?.account);
    const rows = item?.account.dailyTokens ?? [];
    const sonnet = rows.find((row) => row.model === 'claude-sonnet-4-5');
    // Three distinct turns: a, b (once) and c.
    expect(sonnet).toMatchObject({ input: 300, output: 30, messages: 3 });
    expect(rows.some((row) => row.model === 'far-future')).toBe(false);
    const huge = rows.find((row) => row.model.startsWith('mmm'));
    expect(huge?.model.length).toBeLessThanOrEqual(120);
    expect(huge).toMatchObject({ input: Number.MAX_SAFE_INTEGER, output: 0, cacheRead: 7 });
  });
});

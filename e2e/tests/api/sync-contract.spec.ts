import { expect, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import {
  type FleetAccount,
  fleet,
  fleetAccount,
  HOSTILE_TEXT,
  syncFleet,
} from '../../support/accounts';
import { signedUpContext } from '../../support/auth';

/**
 * `POST /accounts/sync` under pressure: the largest payload the contract
 * allows, the same payload many times and many at once, and every way a
 * payload can be wrong. What is protected: a sync is all-or-nothing and
 * repeatable (a desktop app retries after a timeout it cannot tell from a
 * failure), a wrong payload is a 400 that names the field, never a 500, and
 * what is stored is what was sent. A handler that inserts before it checks,
 * or adds tokens instead of replacing a day's count, fails here.
 */

const SYNC = `${API_URL}/api/v1/accounts/sync`;
const device = { name: 'e2e-contract', platform: 'linux' };

interface Listed {
  id: string;
  provider: string;
  externalId: string;
  email: string | null;
  latest: { status: string; windows: Array<{ key: string; utilization: number | null }> } | null;
}

const list = async (api: Awaited<ReturnType<typeof signedUpContext>>['api']) =>
  (await (await api.get(`${API_URL}/api/v1/accounts`)).json()) as Listed[];

test('the largest sync the contract allows goes through whole', async () => {
  const { api, user } = await signedUpContext('syncmax');
  const tag = user.email.split('@')[0].toLowerCase();
  const windows = Array.from({ length: 20 }, (_, i) => ({
    key: `seven_day_model_${i}`,
    kind: 'weekly_model',
    label: `Weekly · Model ${i}`,
    utilization: i * 5,
    resetsAt: new Date(Date.now() + (i + 1) * 3_600_000).toISOString(),
    windowMinutes: 10080,
  }));
  const accounts: FleetAccount[] = Array.from({ length: 50 }, (_, i) => ({
    provider: (['claude-code', 'codex', 'grok'] as const)[i % 3],
    externalId: `${tag}-max-${i}`,
    email: `max${i}.${tag}@fleet.e2e`,
    session: null,
    weekly: null,
    extraWindows: windows,
    tokens: Array.from({ length: 40 }, (_, row) => ({
      model: `model-${row % 8}`,
      input: 1_000 + row,
      daysAgo: Math.floor(row / 8),
    })),
  }));

  const res = await syncFleet(api, accounts);
  expect(res.status(), (await res.text()).slice(0, 500)).toBe(200);
  const stored = await list(api);
  expect(stored).toHaveLength(50);
  for (const account of stored) expect(account.latest?.windows).toHaveLength(20);

  // One account more than the contract holds is refused whole: nothing of it is stored.
  const over = await syncFleet(api, [
    ...accounts,
    { provider: 'codex', externalId: `${tag}-one-too-many`, email: null },
  ]);
  expect(over.status()).toBe(400);
  expect(over.headers()['content-type']).toContain('application/problem+json');
  expect((await list(api)).map((a) => a.externalId)).not.toContain(`${tag}-one-too-many`);
  await api.dispose();
});

test('the same sync, repeated and at once, leaves one row per login and one count per day', async () => {
  const { api, user } = await signedUpContext('syncrepeat');
  const tag = user.email.split('@')[0].toLowerCase();
  const accounts = fleet(tag);

  // A desktop app whose request timed out sends it again; two windows of the app send it together.
  const together = await Promise.all(Array.from({ length: 8 }, () => syncFleet(api, accounts)));
  expect(together.map((res) => res.status()).filter((status) => status >= 500)).toEqual([]);
  for (let i = 0; i < 3; i++) expect((await syncFleet(api, accounts)).status()).toBe(200);

  const stored = await list(api);
  expect(stored).toHaveLength(accounts.length);
  expect(new Set(stored.map((a) => `${a.provider}:${a.externalId}`)).size).toBe(accounts.length);

  // Token counts are the day's count as last read, not a running sum of every sync.
  const usage = await (await api.get(`${API_URL}/api/v1/accounts/usage?days=7`)).json();
  const opus = usage.byModel.find((row: { model: string }) => row.model === 'claude-opus-4-1');
  expect(opus).toMatchObject({ input: 400_000, output: 60_000 });
  const codex = usage.byModel.find((row: { model: string }) => row.model === 'gpt-5-codex');
  expect(codex).toMatchObject({ input: 700_000, output: 30_000 });
  await api.dispose();
});

test('a newer reading replaces the older one, and a sync without a reading keeps the last', async () => {
  const { api, user } = await signedUpContext('syncreplace');
  const tag = user.email.split('@')[0].toLowerCase();
  const login = {
    provider: 'claude-code' as const,
    externalId: `${tag}-one`,
    email: `one.${tag}@fleet.e2e`,
  };

  await syncFleet(api, [{ ...login, weekly: 10 }]);
  await syncFleet(api, [{ ...login, weekly: 80 }]);
  let [stored] = await list(api);
  expect(stored?.latest?.windows.find((w) => w.key === 'seven_day')?.utilization).toBe(80);

  // Signed out of ResetOwl's limits read (no snapshot): the screens keep the last reading.
  await syncFleet(api, [{ ...login, status: null }]);
  [stored] = await list(api);
  expect(stored?.latest?.status).toBe('ok');
  expect(stored?.latest?.windows.find((w) => w.key === 'seven_day')?.utilization).toBe(80);
  await api.dispose();
});

test('every wrong payload is a 400 that names the field, and stores nothing', async () => {
  const { api, user } = await signedUpContext('syncwrong');
  const tag = user.email.split('@')[0].toLowerCase();
  const good = () => fleetAccount({ provider: 'codex', externalId: `${tag}-wrong`, email: null });
  const window = {
    key: 'seven_day',
    kind: 'weekly',
    label: 'Weekly',
    utilization: 10,
    resetsAt: null,
    windowMinutes: 10080,
  };
  const withWindow = (patch: Record<string, unknown>) => ({
    ...good(),
    snapshot: {
      capturedAt: new Date().toISOString(),
      source: 'poll',
      status: 'ok',
      message: null,
      windows: [{ ...window, ...patch }],
      extraUsage: null,
    },
  });
  const tokens = (patch: Record<string, unknown>) => ({
    ...good(),
    dailyTokens: [
      {
        day: '2026-11-01',
        model: 'm',
        input: 1,
        output: 1,
        cacheWrite: 0,
        cacheRead: 0,
        messages: 1,
        ...patch,
      },
    ],
  });

  const WRONG: Array<[string, unknown]> = [
    ['no body', undefined],
    ['an array', []],
    ['no device', { accounts: [] }],
    ['accounts not a list', { device, accounts: 'all of them' }],
    ['an unknown provider', { device, accounts: [{ ...good(), provider: 'cursor' }] }],
    ['a hand-tracked provider', { device, accounts: [{ ...good(), provider: 'zai' }] }],
    ['an empty externalId', { device, accounts: [{ ...good(), externalId: '' }] }],
    [
      'an externalId past its length',
      { device, accounts: [{ ...good(), externalId: 'x'.repeat(201) }] },
    ],
    ['an email past its length', { device, accounts: [{ ...good(), email: 'e'.repeat(321) }] }],
    ['a window with no key', { device, accounts: [withWindow({ key: '' })] }],
    ['a window of an unknown kind', { device, accounts: [withWindow({ kind: 'daily' })] }],
    ['usage past 1000%', { device, accounts: [withWindow({ utilization: 1001 })] }],
    ['negative usage', { device, accounts: [withWindow({ utilization: -1 })] }],
    ['a reset that is not a date', { device, accounts: [withWindow({ resetsAt: 'tomorrow' })] }],
    [
      'a reset in year 275760',
      { device, accounts: [withWindow({ resetsAt: '+275760-09-13T00:00:00.000Z' })] },
    ],
    ['a window of half a minute', { device, accounts: [withWindow({ windowMinutes: 0.5 })] }],
    ['a window of no minutes', { device, accounts: [withWindow({ windowMinutes: 0 })] }],
    [
      'a status the screens do not know',
      {
        device,
        accounts: [
          { ...withWindow({}), snapshot: { ...withWindow({}).snapshot, status: 'pending' } },
        ],
      },
    ],
    [
      'twenty-one windows',
      {
        device,
        accounts: [
          {
            ...withWindow({}),
            snapshot: {
              ...withWindow({}).snapshot,
              windows: Array.from({ length: 21 }, () => window),
            },
          },
        ],
      },
    ],
    ['a day that is not a day', { device, accounts: [tokens({ day: '2026-13-45' })] }],
    ['a negative token count', { device, accounts: [tokens({ input: -1 })] }],
    ['a fractional token count', { device, accounts: [tokens({ output: 1.5 })] }],
    ['a token count as text', { device, accounts: [tokens({ input: '100' })] }],
    [
      'a billing day of 32',
      { device, accounts: [{ ...good(), reportedRenewal: { day: 32, checkedAt: null } }] },
    ],
  ];

  const answers: Array<[string, number, string]> = [];
  for (const [name, data] of WRONG) {
    const res = await api.post(SYNC, { data });
    answers.push([name, res.status(), res.headers()['content-type'] ?? '']);
  }
  expect(answers.filter(([, status]) => status !== 400)).toEqual([]);
  expect(answers.filter(([, , type]) => !type.includes('application/problem+json'))).toEqual([]);
  expect(await list(api)).toEqual([]);

  // A sync is whole: one wrong account among good ones stores none of them.
  const mixed = await api.post(SYNC, {
    data: {
      device,
      accounts: [good(), { ...good(), externalId: `${tag}-second`, provider: 'cursor' }],
    },
  });
  expect(mixed.status()).toBe(400);
  expect(await list(api)).toEqual([]);
  await api.dispose();
});

test('what a login file or a vendor wrote is stored as text and handed back as JSON', async () => {
  const { api, user } = await signedUpContext('synctext');
  const tag = user.email.split('@')[0].toLowerCase();
  const texts = [
    HOSTILE_TEXT,
    "Robert'); DROP TABLE account;--",
    '名前 🦉 ‮reversed',
    '{{7*7}} #{7*7} %s %n',
    '../../../../etc/passwd',
    ' \t padded \n ',
  ];
  const accounts: FleetAccount[] = texts.map((text, i) => ({
    provider: 'claude-code',
    externalId: `${tag}-text-${i}`,
    email: text,
    organization: text,
    reportedPlan: text.slice(0, 80),
    location: text,
    status: 'error',
    message: text,
    tokens: [{ model: text.trim() || 'm', input: 5 }],
  }));

  const res = await syncFleet(api, accounts);
  expect(res.status(), (await res.text()).slice(0, 500)).toBe(200);
  expect(res.headers()['content-type']).toContain('application/json');
  const stored = await list(api);
  expect(stored).toHaveLength(texts.length);
  // No tag survives into what the screens are handed.
  expect(JSON.stringify(stored)).not.toMatch(/<script|<img/i);
  // And the table is still there.
  expect((await syncFleet(api, accounts)).status()).toBe(200);
  expect(await list(api)).toHaveLength(texts.length);
  await api.dispose();
});

test('a sync needs a session, and one person’s sync never lands on another’s', async ({
  request,
}) => {
  const anonymous = await request.post(SYNC, {
    data: { device, accounts: [] },
    headers: { Origin: 'http://localhost:3000' },
  });
  expect(anonymous.status()).toBe(401);

  const first = await signedUpContext('syncfirst');
  const second = await signedUpContext('syncsecond');
  // The same login on two people's machines: a shared team account, signed in twice.
  const shared: FleetAccount = {
    provider: 'codex',
    externalId: 'shared-team-account',
    email: 'team@fleet.e2e',
    weekly: 10,
  };
  await syncFleet(first.api, [shared]);
  await syncFleet(second.api, [{ ...shared, weekly: 90 }]);

  const [mine] = await list(first.api);
  const [theirs] = await list(second.api);
  expect(mine?.id).not.toBe(theirs?.id);
  expect(mine?.latest?.windows.find((w) => w.key === 'secondary')?.utilization).toBe(10);
  expect(theirs?.latest?.windows.find((w) => w.key === 'secondary')?.utilization).toBe(90);
  await first.api.dispose();
  await second.api.dispose();
});

test('a body past the size limit is refused as too large, never as a server fault', async ({
  request,
}) => {
  // Refused by the parser before anything reads it, so the answer needs no session.
  const res = await request.post(SYNC, {
    data: { device, accounts: [], padding: 'x'.repeat(3 * 1024 * 1024) },
    headers: { Origin: 'http://localhost:3000' },
  });
  expect(res.status()).toBe(413);
  expect(res.headers()['content-type']).toContain('application/problem+json');
  expect(await res.json()).toMatchObject({ status: 413, title: 'Payload Too Large' });
});

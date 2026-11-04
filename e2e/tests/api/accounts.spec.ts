import { expect, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { syncTwoAccounts } from '../../support/accounts';
import { signedUpContext } from '../../support/auth';

/** The accounts API: what the desktop collector writes and the screens read. */

test('sync registers logins once and answers with every account', async () => {
  const { api } = await signedUpContext('accountsync');
  const first = await syncTwoAccounts(api);
  expect(first.ok()).toBe(true);
  await syncTwoAccounts(api);

  const list = await (await api.get(`${API_URL}/api/v1/accounts`)).json();
  expect(list).toHaveLength(2);
  const claude = list.find((account: { provider: string }) => account.provider === 'claude-code');
  expect(claude).toMatchObject({ planId: 'claude-ultra', monthlyPriceCents: 20000 });
  await api.dispose();
});

test("one person cannot see or change another's accounts", async () => {
  const owner = await signedUpContext('accountowner');
  await syncTwoAccounts(owner.api);
  const [account] = await (await owner.api.get(`${API_URL}/api/v1/accounts`)).json();

  const other = await signedUpContext('accountother');
  expect(await (await other.api.get(`${API_URL}/api/v1/accounts`)).json()).toEqual([]);
  const patch = await other.api.patch(`${API_URL}/api/v1/accounts/${account.id}`, {
    data: { label: 'mine now' },
  });
  expect(patch.status()).toBe(404);
  await owner.api.dispose();
  await other.api.dispose();
});

test('a removed account stays removed when the next sync reports it', async () => {
  const { api } = await signedUpContext('accountarchive');
  await syncTwoAccounts(api);
  const [account] = await (await api.get(`${API_URL}/api/v1/accounts`)).json();
  expect((await api.delete(`${API_URL}/api/v1/accounts/${account.id}`)).status()).toBe(204);

  await syncTwoAccounts(api);
  const list = await (await api.get(`${API_URL}/api/v1/accounts`)).json();
  expect(list.map((a: { id: string }) => a.id)).not.toContain(account.id);
  await api.dispose();
});

test('a Z.AI Coding Plan is added by hand, priced, and its usage recorded', async () => {
  const { api } = await signedUpContext('accountzai');

  // Pro has no published price: the API refuses it without the one paid.
  const unpriced = await api.post(`${API_URL}/api/v1/accounts`, {
    data: { provider: 'zai', label: 'GLM', planId: 'zai-pro' },
  });
  expect(unpriced.status()).toBe(400);

  const created = await api.post(`${API_URL}/api/v1/accounts`, {
    data: { provider: 'zai', label: 'GLM', planId: 'zai-lite', renewalDay: 9 },
  });
  expect(created.status()).toBe(201);
  const account = await created.json();
  expect(account).toMatchObject({
    provider: 'zai',
    displayName: 'GLM',
    planId: 'zai-lite',
    monthlyPriceCents: 1800,
    renewalDay: 9,
    lastSyncedAt: null,
    latest: null,
  });
  expect(account.externalId).toMatch(/^manual:/);

  const recorded = await api.post(`${API_URL}/api/v1/accounts/${account.id}/usage`, {
    data: {
      sessionUtilization: 25,
      weeklyUtilization: 40,
      weeklyResetsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    },
  });
  expect(recorded.status()).toBe(200);
  const reading = (await recorded.json()).latest;
  expect(reading).toMatchObject({ source: 'manual', status: 'ok' });
  expect(reading.windows.map((w: { kind: string }) => w.kind)).toEqual(['session', 'weekly']);

  // No login on the machine: terminals cannot be pointed at it.
  const activate = await api.post(`${API_URL}/api/v1/accounts/${account.id}/activate`);
  expect(activate.status()).toBe(409);
  await api.dispose();
});

test('Claude Code and Codex are never added by hand, nor Z.AI synced', async () => {
  const { api } = await signedUpContext('accountmanualonly');
  const manualCodex = await api.post(`${API_URL}/api/v1/accounts`, {
    data: { provider: 'codex', label: 'Codex', planId: 'codex-plus' },
  });
  expect(manualCodex.status()).toBe(400);

  await syncTwoAccounts(api);
  const [synced] = await (await api.get(`${API_URL}/api/v1/accounts`)).json();
  const typed = await api.post(`${API_URL}/api/v1/accounts/${synced.id}/usage`, {
    data: { sessionUtilization: null, weeklyUtilization: 10, weeklyResetsAt: null },
  });
  expect(typed.status()).toBe(409);
  await api.dispose();
});

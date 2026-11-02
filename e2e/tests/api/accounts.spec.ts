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

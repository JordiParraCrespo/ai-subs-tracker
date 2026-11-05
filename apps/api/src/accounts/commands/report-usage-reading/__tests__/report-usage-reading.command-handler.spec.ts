import { AppError } from '@flama/backend-core';
import type { UsageSnapshot } from '@flama/shared/schemas/accounts';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { AccountRepositoryPort } from '../../../database/account.repository.port';
import type { UsageRepositoryPort } from '../../../database/usage.repository.port';
import { AccountEntity } from '../../../domain/account.entity';
import { ReportUsageReadingCommand } from '../report-usage-reading.command';
import { ReportUsageReadingCommandHandler } from '../report-usage-reading.command-handler';

const bigmodel = () =>
  AccountEntity.addManual('a1', {
    userId: 'user-1',
    provider: 'bigmodel',
    label: 'GLM',
    email: null,
    planId: 'bigmodel-pro',
    monthlyPriceCents: 2000,
    renewalDay: null,
  });

const codex = () =>
  AccountEntity.register('c1', {
    userId: 'user-1',
    provider: 'codex',
    externalId: 'acct',
    email: null,
    organization: null,
    reportedPlan: 'plus',
    location: null,
    at: new Date(),
  });

function setup(account: AccountEntity | null) {
  const accounts = {
    findOwned: vi.fn().mockResolvedValue(account ? Some(account) : None),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const usage = { recordSnapshot: vi.fn().mockResolvedValue(undefined) };
  const handler = new ReportUsageReadingCommandHandler(
    accounts as unknown as AccountRepositoryPort,
    usage as unknown as UsageRepositoryPort,
  );
  return { accounts, usage, handler };
}

const snapshot: UsageSnapshot = {
  // A desktop clock running a day ahead.
  capturedAt: '2099-01-01T00:00:00.000Z',
  source: 'unofficial',
  status: 'ok',
  message: null,
  windows: [
    {
      key: 'weekly',
      kind: 'weekly',
      label: 'Weekly',
      utilization: 40,
      resetsAt: '2026-11-09T08:00:00.000Z',
      windowMinutes: 10080,
    },
  ],
  extraUsage: null,
};

const reading = { userId: 'user-1', accountId: 'a1', reportedPlan: 'pro', snapshot };

describe('ReportUsageReadingCommandHandler', () => {
  it('stores the reading as unofficial, stamped when it arrived, and keeps the tier the vendor named', async () => {
    const { accounts, usage, handler } = setup(bigmodel());
    const before = Date.now();

    await handler.execute(new ReportUsageReadingCommand(reading));

    const [accountId, stored] = usage.recordSnapshot.mock.calls[0] as [string, UsageSnapshot];
    expect(accountId).toBe('a1');
    expect(stored.source).toBe('unofficial');
    expect(stored.windows).toEqual(snapshot.windows);
    expect(new Date(stored.capturedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(stored.capturedAt).getTime()).toBeLessThanOrEqual(Date.now());
    const saved = accounts.save.mock.calls[0]?.[0] as AccountEntity;
    expect(saved.reportedPlan).toBe('pro');
    // The person's chosen plan still decides the price and the name.
    expect(saved.plan?.id).toBe('bigmodel-pro');
  });

  // Only a provider with an unofficial reader takes one: a collected login
  // has its own readings, which this would contradict.
  it('refuses an account with no unofficial reader', async () => {
    const { usage, handler } = setup(codex());
    await expect(
      handler.execute(new ReportUsageReadingCommand({ ...reading, accountId: 'c1' })),
    ).rejects.toMatchObject({ code: 'ACCOUNT_004' });
    expect(usage.recordSnapshot).not.toHaveBeenCalled();
  });

  it('reads someone else’s account as not found', async () => {
    const { usage, handler } = setup(null);
    await expect(handler.execute(new ReportUsageReadingCommand(reading))).rejects.toBeInstanceOf(
      AppError,
    );
    expect(usage.recordSnapshot).not.toHaveBeenCalled();
  });
});

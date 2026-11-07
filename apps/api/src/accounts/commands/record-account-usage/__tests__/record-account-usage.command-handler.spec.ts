import { AppError } from '@flama/backend-core';
import type { UsageSnapshot } from '@flama/shared/schemas/accounts';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { AccountRepositoryPort } from '../../../database/account.repository.port';
import type { UsageRepositoryPort } from '../../../database/usage.repository.port';
import { AccountEntity } from '../../../domain/account.entity';
import { RecordAccountUsageCommand } from '../record-account-usage.command';
import { RecordAccountUsageCommandHandler } from '../record-account-usage.command-handler';

const zai = () =>
  AccountEntity.addManual('a1', {
    userId: 'user-1',
    provider: 'zai',
    label: 'GLM',
    email: null,
    planId: 'zai-lite',
    monthlyPriceCents: null,
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
    reportedRenewal: null,
    at: new Date(),
  });

function setup(account: AccountEntity | null) {
  const accounts = { findOwned: vi.fn().mockResolvedValue(account ? Some(account) : None) };
  const usage = { recordSnapshot: vi.fn().mockResolvedValue(undefined) };
  const handler = new RecordAccountUsageCommandHandler(
    accounts as unknown as AccountRepositoryPort,
    usage as unknown as UsageRepositoryPort,
  );
  return { usage, handler };
}

const reading = {
  userId: 'user-1',
  accountId: 'a1',
  usage: {
    sessionUtilization: 30,
    weeklyUtilization: 55,
    weeklyResetsAt: new Date('2026-11-09T08:00:00Z'),
  },
};

describe('RecordAccountUsageCommandHandler', () => {
  it('stores the reading as a manual snapshot the screens read like any other', async () => {
    const { usage, handler } = setup(zai());

    await handler.execute(new RecordAccountUsageCommand(reading));

    const [accountId, snapshot, retention] = usage.recordSnapshot.mock.calls[0] as [
      string,
      UsageSnapshot,
      number,
    ];
    expect(accountId).toBe('a1');
    expect(retention).toBe(90);
    expect(snapshot).toMatchObject({ source: 'manual', status: 'ok' });
    expect(snapshot.windows.map((w) => [w.kind, w.utilization])).toEqual([
      ['session', 30],
      ['weekly', 55],
    ]);
    expect(snapshot.windows[1]?.resetsAt).toBe('2026-11-09T08:00:00.000Z');
  });

  // A typed reading on a collected login would be overwritten by the next
  // sync and make its history lie in between.
  it('refuses an account the collector reads', async () => {
    const { usage, handler } = setup(codex());
    await expect(
      handler.execute(new RecordAccountUsageCommand({ ...reading, accountId: 'c1' })),
    ).rejects.toMatchObject({ code: 'ACCOUNT_002' });
    expect(usage.recordSnapshot).not.toHaveBeenCalled();
  });

  it('answers not found for an account the caller does not own', async () => {
    const { handler } = setup(null);
    await expect(handler.execute(new RecordAccountUsageCommand(reading))).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

import type { SyncAccount } from '@flama/shared/schemas/accounts';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountMapper } from '../../../account.mapper';
import type { AccountRepositoryPort } from '../../../database/account.repository.port';
import type { UsageRepositoryPort } from '../../../database/usage.repository.port';
import { AccountEntity } from '../../../domain/account.entity';
import { SyncAccountsCommand } from '../sync-accounts.command';
import { SyncAccountsCommandHandler } from '../sync-accounts.command-handler';

const login: SyncAccount = {
  provider: 'codex',
  externalId: 'chatgpt-acct',
  email: 'me@example.com',
  organization: null,
  reportedPlan: 'plus',
  location: '~/.codex',
  snapshot: {
    capturedAt: '2026-11-02T10:00:00Z',
    source: 'poll',
    status: 'ok',
    message: null,
    windows: [],
    extraUsage: null,
  },
  dailyTokens: [
    {
      day: '2026-11-02',
      model: 'gpt-6.1-sol',
      input: 10,
      output: 5,
      cacheWrite: 0,
      cacheRead: 2,
      messages: 1,
    },
  ],
};

const command = (accounts = [login]) =>
  new SyncAccountsCommand({
    userId: 'user-1',
    device: { name: 'laptop', platform: 'darwin' },
    accounts,
  });

describe('SyncAccountsCommandHandler', () => {
  let accounts: Pick<AccountRepositoryPort, 'findByLogin' | 'register' | 'save'>;
  let usage: Pick<UsageRepositoryPort, 'recordSnapshot' | 'replaceDailyTokens'>;
  let handler: SyncAccountsCommandHandler;

  beforeEach(() => {
    accounts = {
      findByLogin: vi.fn().mockResolvedValue(None),
      register: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockImplementation((entity: AccountEntity) => Promise.resolve(entity)),
    };
    usage = {
      recordSnapshot: vi.fn().mockResolvedValue(undefined),
      replaceDailyTokens: vi.fn().mockResolvedValue(undefined),
    };
    handler = new SyncAccountsCommandHandler(
      accounts as AccountRepositoryPort,
      usage as UsageRepositoryPort,
      new AccountMapper(),
    );
  });

  it('registers a login seen for the first time and records its telemetry', async () => {
    const ids = await handler.execute(command());
    expect(accounts.register).toHaveBeenCalledTimes(1);
    const created = vi.mocked(accounts.register).mock.calls[0][0] as AccountEntity;
    expect(created.userId).toBe('user-1');
    expect(created.plan?.id).toBe('codex-plus');
    expect(ids).toEqual([created.id]);
    expect(usage.recordSnapshot).toHaveBeenCalledWith(created.id, login.snapshot, 90);
    // Token totals are keyed by device, so two machines never overwrite each other.
    expect(usage.replaceDailyTokens).toHaveBeenCalledWith(created.id, 'laptop', login.dailyTokens);
  });

  // The Renewals calendar puts a Codex plan on the day its login reports;
  // dropped here, it would sit under "No renewal day yet".
  it('keeps the billing day the login reports', async () => {
    await handler.execute(
      command([{ ...login, reportedRenewal: { day: 23, checkedAt: '2026-09-22T10:09:48Z' } }]),
    );
    const created = vi.mocked(accounts.register).mock.calls[0][0] as AccountEntity;
    expect(created.renewalDay).toBe(23);
    expect(created.renewalDayOverridden).toBe(false);
    expect(created.renewalCheckedAt?.toISOString()).toBe('2026-09-22T10:09:48.000Z');
  });

  // Without this, removing an account in the app would be undone by the next sync.
  // Two syncs of one machine at once (the collector's run and a live reading)
  // both find no row; the one that loses the write must not fail the sync.
  it('records the sighting on the row another sync registered first, instead of failing', async () => {
    const theirs = AccountEntity.register('acc-theirs', {
      userId: 'user-1',
      provider: 'codex',
      externalId: 'chatgpt-acct',
      email: null,
      organization: null,
      reportedPlan: null,
      location: null,
      reportedRenewal: null,
      at: new Date(),
    });
    vi.mocked(accounts.findByLogin).mockResolvedValueOnce(None).mockResolvedValueOnce(Some(theirs));
    vi.mocked(accounts.register).mockResolvedValue(false);

    expect(await handler.execute(command())).toEqual(['acc-theirs']);
    expect(accounts.save).toHaveBeenCalledWith(theirs);
    expect(theirs.email).toBe('me@example.com');
    expect(usage.recordSnapshot).toHaveBeenCalledWith('acc-theirs', login.snapshot, 90);
  });

  it('ignores a login its owner removed', async () => {
    const archived = AccountEntity.register('acc-1', {
      userId: 'user-1',
      provider: 'codex',
      externalId: 'chatgpt-acct',
      email: null,
      organization: null,
      reportedPlan: null,
      location: null,
      reportedRenewal: null,
      at: new Date(),
    });
    archived.archive(new Date());
    vi.mocked(accounts.findByLogin).mockResolvedValue(Some(archived));
    expect(await handler.execute(command())).toEqual([]);
    expect(accounts.save).not.toHaveBeenCalled();
    expect(usage.recordSnapshot).not.toHaveBeenCalled();
  });

  it('skips the snapshot when the collector sent none', async () => {
    await handler.execute(command([{ ...login, snapshot: null }]));
    expect(usage.recordSnapshot).not.toHaveBeenCalled();
    expect(usage.replaceDailyTokens).toHaveBeenCalledTimes(1);
  });
});

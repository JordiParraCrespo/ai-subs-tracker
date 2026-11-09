import { randomUUID } from 'node:crypto';
import type { SyncAccount } from '@flama/shared/schemas/accounts';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ACCOUNT_REPOSITORY, USAGE_REPOSITORY } from '../../account.di-tokens';
import { AccountMapper } from '../../account.mapper';
import type { AccountRepositoryPort } from '../../database/account.repository.port';
import type { UsageRepositoryPort } from '../../database/usage.repository.port';
import { AccountEntity } from '../../domain/account.entity';
import { SyncAccountsCommand } from './sync-accounts.command';

/** How long limit readings are kept. */
const SNAPSHOT_RETENTION_DAYS = 90;

/**
 * What a desktop collector read from one machine: each login it found, its
 * limits and its token counts. Registers logins seen for the first time,
 * refreshes identity on the ones it knows, and leaves alone any the owner
 * removed. Returns the ids of the accounts it recorded.
 */
@CommandHandler(SyncAccountsCommand)
export class SyncAccountsCommandHandler implements ICommandHandler<SyncAccountsCommand, string[]> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
    @Inject(USAGE_REPOSITORY)
    private readonly usage: UsageRepositoryPort,
    private readonly mapper: AccountMapper,
  ) {}

  async execute(command: SyncAccountsCommand): Promise<string[]> {
    const recorded: string[] = [];
    for (const input of command.accounts) {
      const account = await this.upsert(command.userId, input);
      if (!account) continue;
      if (input.snapshot) {
        await this.usage.recordSnapshot(account.id, input.snapshot, SNAPSHOT_RETENTION_DAYS);
      }
      await this.usage.replaceDailyTokens(account.id, command.device.name, input.dailyTokens);
      recorded.push(account.id);
    }
    return recorded;
  }

  private async upsert(userId: string, input: SyncAccount): Promise<AccountEntity | null> {
    const sighting = this.mapper.toSighting(input, new Date());
    let found = await this.accounts.findByLogin(userId, input.provider, input.externalId);
    if (found.isNone()) {
      const account = AccountEntity.register(randomUUID(), {
        userId,
        provider: input.provider,
        externalId: input.externalId,
        ...sighting,
      });
      if (await this.accounts.register(account)) return account;
      // Another sync of the same machine registered it between the look and
      // the write (the collector's run and a live reading, two windows of the
      // app). The login is known now: record this sighting on that row.
      found = await this.accounts.findByLogin(userId, input.provider, input.externalId);
      if (found.isNone()) return null;
    }
    const account = found.unwrap();
    if (account.isArchived) return null;
    account.recordSighting(sighting);
    await this.accounts.save(account);
    return account;
  }
}

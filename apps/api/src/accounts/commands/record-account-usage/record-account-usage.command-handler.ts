import { AppError } from '@flama/backend-core';
import type { AggregateID } from '@flama/backend-ddd';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ACCOUNT_REPOSITORY, USAGE_REPOSITORY } from '../../account.di-tokens';
import type { AccountRepositoryPort } from '../../database/account.repository.port';
import type { UsageRepositoryPort } from '../../database/usage.repository.port';
import { AccountErrors } from '../../domain/account.errors';
import { manualSnapshot } from '../../domain/manual-usage.factory';
import { RecordAccountUsageCommand } from './record-account-usage.command';

/** How long limit readings are kept; the same retention a sync applies. */
const SNAPSHOT_RETENTION_DAYS = 90;

/**
 * Records a usage reading the person copied from the vendor's page, for a
 * subscription tracked by hand. A login the collector reads keeps its own
 * readings: a hand-typed one would be overwritten within minutes and would
 * make the history lie in between.
 */
@CommandHandler(RecordAccountUsageCommand)
export class RecordAccountUsageCommandHandler
  implements ICommandHandler<RecordAccountUsageCommand, AggregateID>
{
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
    @Inject(USAGE_REPOSITORY)
    private readonly usage: UsageRepositoryPort,
  ) {}

  async execute(command: RecordAccountUsageCommand): Promise<AggregateID> {
    const found = await this.accounts.findOwned(command.userId, command.accountId);
    if (found.isNone()) throw new AppError(AccountErrors.NOT_FOUND);
    const account = found.unwrap();
    if (!account.isManual) throw new AppError(AccountErrors.USAGE_READ_AUTOMATICALLY);
    const snapshot = manualSnapshot(command.usage, new Date());
    await this.usage.recordSnapshot(account.id, snapshot, SNAPSHOT_RETENTION_DAYS);
    return account.id;
  }
}

import { AppError } from '@flama/backend-core';
import type { AggregateID } from '@flama/backend-ddd';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ACCOUNT_REPOSITORY, USAGE_REPOSITORY } from '../../account.di-tokens';
import type { AccountRepositoryPort } from '../../database/account.repository.port';
import type { UsageRepositoryPort } from '../../database/usage.repository.port';
import { AccountErrors } from '../../domain/account.errors';
import { ReportUsageReadingCommand } from './report-usage-reading.command';

/** How long limit readings are kept; the same retention a sync applies. */
const SNAPSHOT_RETENTION_DAYS = 90;

/**
 * Stores a reading the desktop app took, opt-in, from a hand-tracked
 * provider's unofficial usage endpoint (Z.AI, BigModel). The key it used
 * never reaches the API: only the windows, their resets and the tier do. The
 * reading keeps its `unofficial` source, so the screens say where it came
 * from and let it lapse like one typed by hand.
 */
@CommandHandler(ReportUsageReadingCommand)
export class ReportUsageReadingCommandHandler
  implements ICommandHandler<ReportUsageReadingCommand, AggregateID>
{
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
    @Inject(USAGE_REPOSITORY)
    private readonly usage: UsageRepositoryPort,
  ) {}

  async execute(command: ReportUsageReadingCommand): Promise<AggregateID> {
    const found = await this.accounts.findOwned(command.userId, command.accountId);
    if (found.isNone()) throw new AppError(AccountErrors.NOT_FOUND);
    const account = found.unwrap();
    if (!account.hasUnofficialReader) throw new AppError(AccountErrors.NO_USAGE_READER);
    // Stamped on arrival: a desktop clock that is off must not file it in the future.
    const at = new Date();
    await this.usage.recordSnapshot(
      account.id,
      { ...command.snapshot, source: 'unofficial', capturedAt: at.toISOString() },
      SNAPSHOT_RETENTION_DAYS,
    );
    if (command.reportedPlan && command.reportedPlan !== account.reportedPlan) {
      account.recordSighting({
        email: null,
        organization: null,
        reportedPlan: command.reportedPlan,
        location: null,
        at,
      });
      await this.accounts.save(account);
    }
    return account.id;
  }
}

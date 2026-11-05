import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACCOUNT_REPOSITORY, USAGE_REPOSITORY } from './account.di-tokens';
import { AccountMapper } from './account.mapper';
import { ActivateAccountCommandHandler } from './commands/activate-account/activate-account.command-handler';
import { ActivateAccountHttpController } from './commands/activate-account/activate-account.http.controller';
import { ArchiveAccountCommandHandler } from './commands/archive-account/archive-account.command-handler';
import { ArchiveAccountHttpController } from './commands/archive-account/archive-account.http.controller';
import { CreateAccountCommandHandler } from './commands/create-account/create-account.command-handler';
import { CreateAccountHttpController } from './commands/create-account/create-account.http.controller';
import { RecordAccountUsageCommandHandler } from './commands/record-account-usage/record-account-usage.command-handler';
import { RecordAccountUsageHttpController } from './commands/record-account-usage/record-account-usage.http.controller';
import { ReportUsageReadingCommandHandler } from './commands/report-usage-reading/report-usage-reading.command-handler';
import { ReportUsageReadingHttpController } from './commands/report-usage-reading/report-usage-reading.http.controller';
import { SyncAccountsCommandHandler } from './commands/sync-accounts/sync-accounts.command-handler';
import { SyncAccountsHttpController } from './commands/sync-accounts/sync-accounts.http.controller';
import { UpdateAccountCommandHandler } from './commands/update-account/update-account.command-handler';
import { UpdateAccountHttpController } from './commands/update-account/update-account.http.controller';
import { AccountOrmEntity } from './database/account.orm-entity';
import { AccountRepository } from './database/account.repository';
import { TokenUsageDailyOrmEntity } from './database/token-usage-daily.orm-entity';
import { UsageRepository } from './database/usage.repository';
import { UsageSnapshotOrmEntity } from './database/usage-snapshot.orm-entity';
import { FindAccountsHttpController } from './queries/find-accounts/find-accounts.http.controller';
import { FindAccountsQueryHandler } from './queries/find-accounts/find-accounts.query-handler';
import { GetUsageSummaryHttpController } from './queries/get-usage-summary/get-usage-summary.http.controller';
import { GetUsageSummaryQueryHandler } from './queries/get-usage-summary/get-usage-summary.query-handler';

// Static paths (`usage`, `sync`) before the parameterized `:id` routes.
const httpControllers = [
  FindAccountsHttpController,
  GetUsageSummaryHttpController,
  SyncAccountsHttpController,
  CreateAccountHttpController,
  UpdateAccountHttpController,
  ActivateAccountHttpController,
  RecordAccountUsageHttpController,
  ReportUsageReadingHttpController,
  ArchiveAccountHttpController,
];

const commandHandlers: Provider[] = [
  SyncAccountsCommandHandler,
  CreateAccountCommandHandler,
  UpdateAccountCommandHandler,
  RecordAccountUsageCommandHandler,
  ReportUsageReadingCommandHandler,
  ActivateAccountCommandHandler,
  ArchiveAccountCommandHandler,
];

const queryHandlers: Provider[] = [FindAccountsQueryHandler, GetUsageSummaryQueryHandler];

/**
 * The coding-agent accounts a person tracks: what the desktop collector
 * syncs, the subscriptions added by hand (Z.AI, BigModel) and the readings the desktop takes of them, and what the overview, accounts, tokenmaxx and usage screens read.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([AccountOrmEntity, UsageSnapshotOrmEntity, TokenUsageDailyOrmEntity]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    AccountMapper,
    { provide: ACCOUNT_REPOSITORY, useClass: AccountRepository },
    { provide: USAGE_REPOSITORY, useClass: UsageRepository },
  ],
  exports: [ACCOUNT_REPOSITORY],
})
export class AccountsModule {}

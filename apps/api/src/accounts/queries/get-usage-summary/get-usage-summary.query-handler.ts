import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ACCOUNT_REPOSITORY, USAGE_REPOSITORY } from '../../account.di-tokens';
import type { AccountRepositoryPort } from '../../database/account.repository.port';
import type { AccountDailyTokens, UsageRepositoryPort } from '../../database/usage.repository.port';
import { GetUsageSummaryQuery } from './get-usage-summary.query';

export interface UsageRows {
  days: number;
  since: string;
  rows: AccountDailyTokens[];
}

/** Token counts across the owner's tracked accounts for the last `days` days. */
@QueryHandler(GetUsageSummaryQuery)
export class GetUsageSummaryQueryHandler implements IQueryHandler<GetUsageSummaryQuery, UsageRows> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
    @Inject(USAGE_REPOSITORY)
    private readonly usage: UsageRepositoryPort,
  ) {}

  async execute(query: GetUsageSummaryQuery): Promise<UsageRows> {
    const accounts = await this.accounts.findForUser(query.userId);
    const since = new Date(Date.now() - (query.days - 1) * 86_400_000).toISOString().slice(0, 10);
    const rows = await this.usage.dailyTokens(
      accounts.map((account) => account.id),
      since,
    );
    return { days: query.days, since, rows };
  }
}

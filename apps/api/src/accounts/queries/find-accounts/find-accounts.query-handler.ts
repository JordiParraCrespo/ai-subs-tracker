import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ACCOUNT_REPOSITORY, USAGE_REPOSITORY } from '../../account.di-tokens';
import { AccountMapper } from '../../account.mapper';
import type { AccountRepositoryPort } from '../../database/account.repository.port';
import type { UsageRepositoryPort } from '../../database/usage.repository.port';
import type { AccountView } from '../../domain/account.types';
import { FindAccountsQuery } from './find-accounts.query';

const PEAK_WINDOW_DAYS = 30;

/** The owner's tracked accounts, each with its latest reading and last month's weekly peaks. */
@QueryHandler(FindAccountsQuery)
export class FindAccountsQueryHandler implements IQueryHandler<FindAccountsQuery, AccountView[]> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
    @Inject(USAGE_REPOSITORY)
    private readonly usage: UsageRepositoryPort,
    private readonly mapper: AccountMapper,
  ) {}

  async execute(query: FindAccountsQuery): Promise<AccountView[]> {
    const accounts = await this.accounts.findForUser(query.userId);
    const ids = accounts.map((account) => account.id);
    const now = new Date();
    const since = new Date(now.getTime() - PEAK_WINDOW_DAYS * 86_400_000);
    const [latest, windowed, peaks] = await Promise.all([
      this.usage.latestSnapshots(ids),
      this.usage.latestWindowedSnapshots(ids),
      this.usage.weeklyPeaks(ids, since, now),
    ]);
    return accounts.map((account) => {
      let reading = latest.get(account.id);
      // A login gone stale (access token lapsed, renewable) keeps showing its
      // last good reading instead of empty bars, until its CLI refreshes it.
      if (reading?.status === 'auth_stale') {
        reading = this.mapper.carryStaleWindows(reading, windowed.get(account.id), now);
      }
      return { account, latest: reading, weeklyPeaks: peaks.get(account.id) ?? [] };
    });
  }
}

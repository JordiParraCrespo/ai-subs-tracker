import type { RepositoryPort } from '@flama/backend-ddd';
import type { ProviderId } from '@flama/shared/subscriptions';
import type { Option } from 'oxide.ts';
import type { AccountEntity } from '../domain/account.entity';

/**
 * Port for the account aggregate. Every lookup a route reaches is scoped to
 * the owner: another person's account is simply not found.
 */
export interface AccountRepositoryPort extends RepositoryPort<AccountEntity> {
  findOwned(userId: string, id: string): Promise<Option<AccountEntity>>;
  findByLogin(
    userId: string,
    provider: ProviderId,
    externalId: string,
  ): Promise<Option<AccountEntity>>;
  /** The owner's tracked accounts, archived ones left out. */
  findForUser(userId: string): Promise<AccountEntity[]>;
  /** Writes several aggregates of one owner in one transaction (activation). */
  saveAll(entities: AccountEntity[]): Promise<void>;
}

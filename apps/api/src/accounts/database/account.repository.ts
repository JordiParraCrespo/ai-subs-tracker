import {
  type AggregateID,
  OutboxService,
  Paginated,
  type PaginatedQueryParams,
} from '@flama/backend-ddd';
import type { ProviderId } from '@flama/shared/subscriptions';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, IsNull, QueryFailedError, type Repository } from 'typeorm';
import { AccountMapper } from '../account.mapper';
import type { AccountEntity } from '../domain/account.entity';
import { AccountOrmEntity } from './account.orm-entity';
import type { AccountRepositoryPort } from './account.repository.port';

/** Postgres `unique_violation` on the one-row-per-login constraint. */
function isDuplicateLogin(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driver = error.driverError as { code?: unknown; constraint?: unknown };
  return driver.code === '23505' && driver.constraint === 'UQ_provider_account_login';
}

/** TypeORM adapter for the account aggregate. */
@Injectable()
export class AccountRepository implements AccountRepositoryPort {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly repository: Repository<AccountOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: AccountMapper,
    private readonly outbox: OutboxService,
  ) {}

  async insert(entity: AccountEntity | AccountEntity[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];
    await this.outbox.writeWithEvents(entities, (manager) =>
      manager
        .getRepository(AccountOrmEntity)
        .insert(entities.map((e) => this.mapper.toPersistence(e))),
    );
  }

  async register(entity: AccountEntity): Promise<boolean> {
    try {
      await this.insert(entity);
      return true;
    } catch (error) {
      // The write and its events rolled back together, so losing the race leaves nothing behind.
      if (isDuplicateLogin(error)) return false;
      throw error;
    }
  }

  async save(entity: AccountEntity): Promise<AccountEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(AccountOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async saveAll(entities: AccountEntity[]): Promise<void> {
    // Deactivations first: the partial unique index allows one active account
    // per provider, and it is checked row by row inside the transaction.
    const ordered = [...entities].sort((a, b) => Number(a.isActive) - Number(b.isActive));
    await this.outbox.writeWithEvents(ordered, async (manager) => {
      for (const entity of ordered) {
        await manager.getRepository(AccountOrmEntity).save(this.mapper.toPersistence(entity));
      }
    });
  }

  async findOneById(id: string): Promise<Option<AccountEntity>> {
    const record = await this.repository.findOneBy({ id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOwned(userId: string, id: string): Promise<Option<AccountEntity>> {
    const record = await this.repository.findOneBy({ id, userId, archivedAt: IsNull() });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findByLogin(
    userId: string,
    provider: ProviderId,
    externalId: string,
  ): Promise<Option<AccountEntity>> {
    const record = await this.repository.findOneBy({ userId, provider, externalId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findForUser(userId: string): Promise<AccountEntity[]> {
    const records = await this.repository.find({
      where: { userId, archivedAt: IsNull() },
      order: { provider: 'ASC', createdAt: 'ASC' },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAll(): Promise<AccountEntity[]> {
    const records = await this.repository.find();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAllPaginated(params: PaginatedQueryParams): Promise<Paginated<AccountEntity>> {
    const [records, count] = await this.repository.findAndCount({
      skip: params.offset,
      take: params.limit,
      order: { createdAt: params.orderBy.param === 'asc' ? 'ASC' : 'DESC' },
    });
    return new Paginated({
      count,
      limit: params.limit,
      page: params.page,
      data: records.map((record) => this.mapper.toDomain(record)),
    });
  }

  async delete(entity: AccountEntity): Promise<boolean> {
    const result = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(AccountOrmEntity).delete({ id: entity.id as AggregateID }),
    );
    return (result.affected ?? 0) > 0;
  }

  transaction<T>(handler: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(() => handler());
  }
}

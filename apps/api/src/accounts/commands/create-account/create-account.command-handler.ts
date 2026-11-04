import { randomUUID } from 'node:crypto';
import type { AggregateID } from '@flama/backend-ddd';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ACCOUNT_REPOSITORY } from '../../account.di-tokens';
import type { AccountRepositoryPort } from '../../database/account.repository.port';
import { AccountEntity } from '../../domain/account.entity';
import { CreateAccountCommand } from './create-account.command';

/**
 * Adds a subscription the person tracks by hand (Z.AI's Coding Plan): no
 * collector will ever report it, so its plan, price and billing day are what
 * the person says. Holds no credential.
 */
@CommandHandler(CreateAccountCommand)
export class CreateAccountCommandHandler
  implements ICommandHandler<CreateAccountCommand, AggregateID>
{
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
  ) {}

  async execute(command: CreateAccountCommand): Promise<AggregateID> {
    const account = AccountEntity.addManual(randomUUID(), command.input);
    await this.accounts.insert(account);
    return account.id;
  }
}

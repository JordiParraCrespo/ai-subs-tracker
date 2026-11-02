import { AppError } from '@flama/backend-core';
import type { AggregateID } from '@flama/backend-ddd';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ACCOUNT_REPOSITORY } from '../../account.di-tokens';
import type { AccountRepositoryPort } from '../../database/account.repository.port';
import { AccountErrors } from '../../domain/account.errors';
import { UpdateAccountCommand } from './update-account.command';

/** Renames an account, or sets the plan, price and billing day its owner actually has. */
@CommandHandler(UpdateAccountCommand)
export class UpdateAccountCommandHandler
  implements ICommandHandler<UpdateAccountCommand, AggregateID>
{
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
  ) {}

  async execute(command: UpdateAccountCommand): Promise<AggregateID> {
    const found = await this.accounts.findOwned(command.userId, command.accountId);
    if (found.isNone()) throw new AppError(AccountErrors.NOT_FOUND);
    const account = found.unwrap();
    account.edit({
      label: command.label,
      planId: command.planId,
      monthlyPriceCents: command.monthlyPriceCents,
      renewalDay: command.renewalDay,
    });
    await this.accounts.save(account);
    return account.id;
  }
}

import { AppError } from '@flama/backend-core';
import type { AggregateID } from '@flama/backend-ddd';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ACCOUNT_REPOSITORY } from '../../account.di-tokens';
import type { AccountRepositoryPort } from '../../database/account.repository.port';
import { AccountErrors } from '../../domain/account.errors';
import { ActivateAccountCommand } from './activate-account.command';

/**
 * Makes one login the one a terminal uses for its provider. Only one per
 * provider is active, so the owner's others for that provider are switched
 * off in the same write.
 */
@CommandHandler(ActivateAccountCommand)
export class ActivateAccountCommandHandler
  implements ICommandHandler<ActivateAccountCommand, AggregateID>
{
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
  ) {}

  async execute(command: ActivateAccountCommand): Promise<AggregateID> {
    const found = await this.accounts.findOwned(command.userId, command.accountId);
    if (found.isNone()) throw new AppError(AccountErrors.NOT_FOUND);
    const target = found.unwrap();
    const now = new Date();
    const siblings = (await this.accounts.findForUser(command.userId)).filter(
      (account) => account.provider === target.provider && account.id !== target.id,
    );
    for (const sibling of siblings) sibling.deactivate();
    target.activate(now);
    await this.accounts.saveAll([...siblings, target]);
    return target.id;
  }
}

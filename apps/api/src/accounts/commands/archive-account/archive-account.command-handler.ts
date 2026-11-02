import { AppError } from '@flama/backend-core';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ACCOUNT_REPOSITORY } from '../../account.di-tokens';
import type { AccountRepositoryPort } from '../../database/account.repository.port';
import { AccountErrors } from '../../domain/account.errors';
import { ArchiveAccountCommand } from './archive-account.command';

/** Stops tracking an account; later syncs of the same login are ignored. */
@CommandHandler(ArchiveAccountCommand)
export class ArchiveAccountCommandHandler implements ICommandHandler<ArchiveAccountCommand, void> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
  ) {}

  async execute(command: ArchiveAccountCommand): Promise<void> {
    const found = await this.accounts.findOwned(command.userId, command.accountId);
    if (found.isNone()) throw new AppError(AccountErrors.NOT_FOUND);
    const account = found.unwrap();
    account.archive(new Date());
    await this.accounts.save(account);
  }
}

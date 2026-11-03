import type { UpdateAccountInput } from '@flama/shared/schemas/accounts';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { AccountEntity, UsageSummary } from './accounts.entity';
import type { AccountsRepository } from './accounts.repository';

/** The person's coding-agent accounts: list, edit, switch, remove, and token usage. */
@injectable()
export class AccountsService {
  constructor(
    @inject(TOKENS.AccountsRepository)
    private readonly repository: AccountsRepository,
  ) {}

  list(): Promise<AccountEntity[]> {
    return this.repository.list();
  }

  update(id: string, input: UpdateAccountInput): Promise<AccountEntity> {
    return this.repository.update(id, input);
  }

  /** Answers with every account, since activating one switches its siblings off. */
  activate(id: string): Promise<AccountEntity[]> {
    return this.repository.activate(id);
  }

  archive(id: string): Promise<void> {
    return this.repository.archive(id);
  }

  usage(days: number): Promise<UsageSummary> {
    return this.repository.usage(days);
  }
}

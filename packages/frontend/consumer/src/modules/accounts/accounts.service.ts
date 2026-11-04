import type {
  CreateAccountInput,
  RecordUsageInput,
  UpdateAccountInput,
} from '@flama/shared/schemas/accounts';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { AccountEntity, UsageSummary } from './accounts.entity';
import type { AccountsRepository } from './accounts.repository';

/** The person's coding-agent accounts: list, add by hand, edit, record usage, switch, remove, and token usage. */
@injectable()
export class AccountsService {
  constructor(
    @inject(TOKENS.AccountsRepository)
    private readonly repository: AccountsRepository,
  ) {}

  list(): Promise<AccountEntity[]> {
    return this.repository.list();
  }

  /** Adds a subscription tracked by hand (a provider no machine reports). */
  create(input: CreateAccountInput): Promise<AccountEntity> {
    return this.repository.create(input);
  }

  /** Records a usage reading on a subscription tracked by hand. */
  recordUsage(id: string, input: RecordUsageInput): Promise<AccountEntity> {
    return this.repository.recordUsage(id, input);
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

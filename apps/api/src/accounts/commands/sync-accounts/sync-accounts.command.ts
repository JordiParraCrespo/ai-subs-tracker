import { CommandBase, type CommandProps } from '@flama/backend-ddd';
import type { SyncAccount } from '@flama/shared/schemas/accounts';

export class SyncAccountsCommand extends CommandBase {
  readonly userId: string;
  readonly device: { name: string; platform: string };
  readonly accounts: SyncAccount[];

  constructor(props: CommandProps<SyncAccountsCommand>) {
    super(props);
    this.userId = props.userId;
    this.device = props.device;
    this.accounts = props.accounts;
  }
}

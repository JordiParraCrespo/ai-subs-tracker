import { CommandBase, type CommandProps } from '@flama/backend-ddd';

export class ActivateAccountCommand extends CommandBase {
  readonly userId: string;
  readonly accountId: string;

  constructor(props: CommandProps<ActivateAccountCommand>) {
    super(props);
    this.userId = props.userId;
    this.accountId = props.accountId;
  }
}

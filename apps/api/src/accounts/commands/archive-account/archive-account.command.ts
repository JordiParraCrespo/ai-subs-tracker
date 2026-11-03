import { CommandBase, type CommandProps } from '@flama/backend-ddd';

export class ArchiveAccountCommand extends CommandBase {
  readonly userId: string;
  readonly accountId: string;

  constructor(props: CommandProps<ArchiveAccountCommand>) {
    super(props);
    this.userId = props.userId;
    this.accountId = props.accountId;
  }
}

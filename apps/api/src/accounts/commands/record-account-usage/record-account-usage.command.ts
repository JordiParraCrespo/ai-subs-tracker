import { CommandBase, type CommandProps } from '@flama/backend-ddd';

export class RecordAccountUsageCommand extends CommandBase {
  readonly userId: string;
  readonly accountId: string;
  readonly sessionUtilization: number | null;
  readonly weeklyUtilization: number | null;
  readonly weeklyResetsAt: Date | null;

  constructor(props: CommandProps<RecordAccountUsageCommand>) {
    super(props);
    this.userId = props.userId;
    this.accountId = props.accountId;
    this.sessionUtilization = props.sessionUtilization;
    this.weeklyUtilization = props.weeklyUtilization;
    this.weeklyResetsAt = props.weeklyResetsAt;
  }
}

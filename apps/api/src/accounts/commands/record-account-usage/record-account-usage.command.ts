import { CommandBase, type CommandProps } from '@flama/backend-ddd';
import type { ManualUsage } from '../../domain/manual-usage.factory';

export class RecordAccountUsageCommand extends CommandBase {
  readonly userId: string;
  readonly accountId: string;
  readonly usage: ManualUsage;

  constructor(props: CommandProps<RecordAccountUsageCommand>) {
    super(props);
    this.userId = props.userId;
    this.accountId = props.accountId;
    this.usage = props.usage;
  }
}

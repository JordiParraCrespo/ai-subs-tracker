import { CommandBase, type CommandProps } from '@flama/backend-ddd';
import type { UsageSnapshot } from '@flama/shared/schemas/accounts';

export class ReportUsageReadingCommand extends CommandBase {
  readonly userId: string;
  readonly accountId: string;
  /** The tier the vendor named, kept for information; the person's chosen plan still rules. */
  readonly reportedPlan: string | null;
  readonly snapshot: UsageSnapshot;

  constructor(props: CommandProps<ReportUsageReadingCommand>) {
    super(props);
    this.userId = props.userId;
    this.accountId = props.accountId;
    this.reportedPlan = props.reportedPlan;
    this.snapshot = props.snapshot;
  }
}

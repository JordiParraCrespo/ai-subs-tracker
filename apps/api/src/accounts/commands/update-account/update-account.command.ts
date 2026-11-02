import { CommandBase, type CommandProps } from '@flama/backend-ddd';

export class UpdateAccountCommand extends CommandBase {
  readonly userId: string;
  readonly accountId: string;
  readonly label?: string | null;
  readonly planId?: string | null;
  readonly monthlyPriceCents?: number | null;

  constructor(props: CommandProps<UpdateAccountCommand>) {
    super(props);
    this.userId = props.userId;
    this.accountId = props.accountId;
    this.label = props.label;
    this.planId = props.planId;
    this.monthlyPriceCents = props.monthlyPriceCents;
  }
}

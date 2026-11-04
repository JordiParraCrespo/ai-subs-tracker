import { CommandBase, type CommandProps } from '@flama/backend-ddd';
import type { ManualProviderId } from '@flama/shared/subscriptions';

export class CreateAccountCommand extends CommandBase {
  readonly userId: string;
  readonly provider: ManualProviderId;
  readonly label: string;
  readonly email: string | null;
  readonly planId: string;
  readonly monthlyPriceCents: number | null;
  readonly renewalDay: number | null;

  constructor(props: CommandProps<CreateAccountCommand>) {
    super(props);
    this.userId = props.userId;
    this.provider = props.provider;
    this.label = props.label;
    this.email = props.email;
    this.planId = props.planId;
    this.monthlyPriceCents = props.monthlyPriceCents;
    this.renewalDay = props.renewalDay;
  }
}

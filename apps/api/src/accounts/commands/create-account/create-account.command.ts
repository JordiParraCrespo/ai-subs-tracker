import { CommandBase, type CommandProps } from '@flama/backend-ddd';
import type { ManualAccountInput } from '../../domain/account.entity';

export class CreateAccountCommand extends CommandBase {
  readonly input: ManualAccountInput;

  constructor(props: CommandProps<CreateAccountCommand>) {
    super(props);
    this.input = props.input;
  }
}

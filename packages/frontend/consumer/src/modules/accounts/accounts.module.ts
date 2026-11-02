import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { AccountsRepository } from './accounts.repository';
import { AccountsService } from './accounts.service';

export const AccountsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.AccountsRepository).to(AccountsRepository).inSingletonScope();
  bind(TOKENS.AccountsService).to(AccountsService).inSingletonScope();
});

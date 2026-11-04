import { ApiAuthProblemResponses, ApiProblemResponse } from '@flama/backend-core';
import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { AccountMapper } from '../../account.mapper';
import type { AccountView } from '../../domain/account.types';
import { AccountResponseDto } from '../../dtos/account.response.dto';
import { FindAccountsQuery } from '../../queries/find-accounts/find-accounts.query';
import { ActivateAccountCommand } from './activate-account.command';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('accounts')
export class ActivateAccountHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AccountMapper,
  ) {}

  @Post(':id/activate')
  @HttpCode(200)
  @NoPolicy('switches between the caller’s own accounts; ownership is checked on load')
  @Version('1')
  @RequireScopes('accounts:write')
  @ApiOperation({
    operationId: 'activateAccount',
    summary: 'Make this the account terminals use for its provider',
    description:
      'Deactivates the owner’s other accounts of the same provider. Answers with every account.',
  })
  @ApiResponse({ status: 200, type: [AccountResponseDto] })
  @ApiProblemResponse({ status: 404, description: 'Account not found', code: 'ACCOUNT_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'A hand-tracked subscription is not used from a terminal',
    code: 'ACCOUNT_003',
  })
  async activate(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) accountId: string,
  ): Promise<AccountResponseDto[]> {
    await this.commandBus.execute(new ActivateAccountCommand({ userId, accountId }));
    const views = await this.queryBus.execute<FindAccountsQuery, AccountView[]>(
      new FindAccountsQuery(userId),
    );
    return views.map((view) =>
      this.mapper.toAccountResponse(view.account, view.latest, view.weeklyPeaks),
    );
  }
}

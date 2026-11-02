import { ApiAuthProblemResponses, ApiProblemResponse } from '@flama/backend-core';
import { Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards, Version } from '@nestjs/common';
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
import { UpdateAccountCommand } from './update-account.command';
import { UpdateAccountRequest } from './update-account.request.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('accounts')
export class UpdateAccountHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AccountMapper,
  ) {}

  @Patch(':id')
  @NoPolicy('edits one of the caller’s own accounts; ownership is checked on load')
  @Version('1')
  @RequireScopes('accounts:write')
  @ApiOperation({ summary: 'Rename an account or set its plan and price' })
  @ApiResponse({ status: 200, type: AccountResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Account not found', code: 'ACCOUNT_001' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) accountId: string,
    @Body() body: UpdateAccountRequest,
  ): Promise<AccountResponseDto> {
    await this.commandBus.execute(new UpdateAccountCommand({ userId, accountId, ...body }));
    const views = await this.queryBus.execute<FindAccountsQuery, AccountView[]>(
      new FindAccountsQuery(userId),
    );
    const view = views.find((candidate) => candidate.account.id === accountId);
    return this.mapper.toAccountResponse(view!.account, view?.latest, view?.weeklyPeaks ?? []);
  }
}

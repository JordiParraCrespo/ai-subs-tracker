import { ApiAuthProblemResponses } from '@flama/backend-core';
import { Body, Controller, HttpCode, Post, UseGuards, Version } from '@nestjs/common';
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
import { SyncAccountsCommand } from './sync-accounts.command';
import { SyncAccountsRequest } from './sync-accounts.request.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('accounts')
export class SyncAccountsHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AccountMapper,
  ) {}

  @Post('sync')
  @HttpCode(200)
  @NoPolicy('records the caller’s own logins, read on their own machine')
  @Version('1')
  @RequireScopes('accounts:write')
  @ApiOperation({
    summary: 'Report the logins, limits and token counts a desktop app read',
    description: 'Never carries a credential. Answers with every tracked account.',
  })
  @ApiResponse({ status: 200, type: [AccountResponseDto] })
  async sync(
    @CurrentUser('id') userId: string,
    @Body() body: SyncAccountsRequest,
  ): Promise<AccountResponseDto[]> {
    await this.commandBus.execute(new SyncAccountsCommand({ userId, ...body }));
    const views = await this.queryBus.execute<FindAccountsQuery, AccountView[]>(
      new FindAccountsQuery(userId),
    );
    return views.map((view) =>
      this.mapper.toAccountResponse(view.account, view.latest, view.weeklyPeaks),
    );
  }
}

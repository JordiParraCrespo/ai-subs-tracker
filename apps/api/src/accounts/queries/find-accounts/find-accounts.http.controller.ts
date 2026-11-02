import { ApiAuthProblemResponses } from '@flama/backend-core';
import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { AccountMapper } from '../../account.mapper';
import type { AccountView } from '../../domain/account.types';
import { AccountResponseDto } from '../../dtos/account.response.dto';
import { FindAccountsQuery } from './find-accounts.query';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('accounts')
export class FindAccountsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AccountMapper,
  ) {}

  @Get()
  @NoPolicy('lists the caller’s own accounts')
  @Version('1')
  @RequireScopes('accounts:read')
  @ApiOperation({ summary: 'List my coding-agent accounts with their latest limits' })
  @ApiResponse({ status: 200, type: [AccountResponseDto] })
  async findAll(@CurrentUser('id') userId: string): Promise<AccountResponseDto[]> {
    const views = await this.queryBus.execute<FindAccountsQuery, AccountView[]>(
      new FindAccountsQuery(userId),
    );
    return views.map((view) =>
      this.mapper.toAccountResponse(view.account, view.latest, view.weeklyPeaks),
    );
  }
}

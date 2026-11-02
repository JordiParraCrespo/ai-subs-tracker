import { ApiAuthProblemResponses } from '@flama/backend-core';
import { Controller, Get, Query, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { AccountMapper } from '../../account.mapper';
import { UsageSummaryResponseDto } from '../../dtos/usage-summary.response.dto';
import { GetUsageSummaryQuery } from './get-usage-summary.query';
import type { UsageRows } from './get-usage-summary.query-handler';
import { GetUsageSummaryRequest } from './get-usage-summary.request.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('accounts')
export class GetUsageSummaryHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AccountMapper,
  ) {}

  @Get('usage')
  @NoPolicy('summarises the caller’s own token usage')
  @Version('1')
  @RequireScopes('accounts:read')
  @ApiOperation({
    summary: 'Tokens used across my accounts, by model, account and day, priced at API rates',
  })
  @ApiResponse({ status: 200, type: UsageSummaryResponseDto })
  async summary(
    @CurrentUser('id') userId: string,
    @Query() query: GetUsageSummaryRequest,
  ): Promise<UsageSummaryResponseDto> {
    const result = await this.queryBus.execute<GetUsageSummaryQuery, UsageRows>(
      new GetUsageSummaryQuery(userId, query.days),
    );
    return this.mapper.toUsageSummary(result.rows, result.days, result.since);
  }
}

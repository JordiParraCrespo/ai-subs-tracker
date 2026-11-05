import { ApiAuthProblemResponses, ApiProblemResponse, AppError } from '@flama/backend-core';
import {
  Body,
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
import { AccountErrors } from '../../domain/account.errors';
import type { AccountView } from '../../domain/account.types';
import { AccountResponseDto } from '../../dtos/account.response.dto';
import { FindAccountsQuery } from '../../queries/find-accounts/find-accounts.query';
import { ReportUsageReadingCommand } from './report-usage-reading.command';
import { ReportUsageReadingRequest } from './report-usage-reading.request.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('accounts')
export class ReportUsageReadingHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AccountMapper,
  ) {}

  @Post(':id/readings')
  @HttpCode(200)
  @NoPolicy('stores a reading on one of the caller’s own accounts; ownership is checked on load')
  @Version('1')
  @RequireScopes('accounts:write')
  @ApiOperation({
    operationId: 'reportUsageReading',
    summary: 'Store a reading the desktop app took from a vendor’s unofficial usage endpoint',
    description:
      'For a hand-tracked GLM Coding Plan (Z.AI, BigModel) whose owner turned on automatic reading in the desktop app. Limit windows with the vendor’s own resets, and the tier it named; never a key. Stored with the source `unofficial`.',
  })
  @ApiResponse({ status: 200, type: AccountResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Account not found', code: 'ACCOUNT_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The account’s usage cannot be read from its vendor',
    code: 'ACCOUNT_004',
  })
  async report(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) accountId: string,
    @Body() body: ReportUsageReadingRequest,
  ): Promise<AccountResponseDto> {
    await this.commandBus.execute(
      new ReportUsageReadingCommand({
        userId,
        accountId,
        reportedPlan: body.reportedPlan,
        snapshot: body.snapshot,
      }),
    );
    const views = await this.queryBus.execute<FindAccountsQuery, AccountView[]>(
      new FindAccountsQuery(userId),
    );
    const view = views.find((candidate) => candidate.account.id === accountId);
    if (!view) throw new AppError(AccountErrors.NOT_FOUND);
    return this.mapper.toAccountResponse(view.account, view.latest, view.weeklyPeaks);
  }
}

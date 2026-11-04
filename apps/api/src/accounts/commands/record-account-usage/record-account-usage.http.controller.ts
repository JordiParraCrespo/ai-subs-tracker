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
import { RecordAccountUsageCommand } from './record-account-usage.command';
import { RecordAccountUsageRequest } from './record-account-usage.request.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('accounts')
export class RecordAccountUsageHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AccountMapper,
  ) {}

  @Post(':id/usage')
  @HttpCode(200)
  @NoPolicy('records a reading on one of the caller’s own accounts; ownership is checked on load')
  @Version('1')
  @RequireScopes('accounts:write')
  @ApiOperation({
    operationId: 'recordAccountUsage',
    summary: 'Record a usage reading for a subscription tracked by hand',
    description:
      'Percent of the 5-hour and weekly allowances used, as the vendor’s usage page shows them.',
  })
  @ApiResponse({ status: 200, type: AccountResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Account not found', code: 'ACCOUNT_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The account’s usage is read from the machine',
    code: 'ACCOUNT_002',
  })
  async record(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) accountId: string,
    @Body() body: RecordAccountUsageRequest,
  ): Promise<AccountResponseDto> {
    await this.commandBus.execute(
      new RecordAccountUsageCommand({
        userId,
        accountId,
        sessionUtilization: body.sessionUtilization,
        weeklyUtilization: body.weeklyUtilization,
        weeklyResetsAt: body.weeklyResetsAt ? new Date(body.weeklyResetsAt) : null,
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

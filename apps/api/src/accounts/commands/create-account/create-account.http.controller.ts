import { ApiAuthProblemResponses, AppError } from '@flama/backend-core';
import { Body, Controller, HttpCode, Post, UseGuards, Version } from '@nestjs/common';
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
import { CreateAccountCommand } from './create-account.command';
import { CreateAccountRequest } from './create-account.request.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('accounts')
export class CreateAccountHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AccountMapper,
  ) {}

  @Post()
  @HttpCode(201)
  @NoPolicy('adds a subscription to the caller’s own list')
  @Version('1')
  @RequireScopes('accounts:write')
  @ApiOperation({
    operationId: 'createAccount',
    summary: 'Add a subscription tracked by hand',
    description:
      'For providers ResetOwl cannot read on the machine (Z.AI Coding Plan). Takes no credential.',
  })
  @ApiResponse({ status: 201, type: AccountResponseDto })
  async create(
    @CurrentUser('id') userId: string,
    @Body() body: CreateAccountRequest,
  ): Promise<AccountResponseDto> {
    const accountId = await this.commandBus.execute<CreateAccountCommand, string>(
      new CreateAccountCommand({
        userId,
        provider: body.provider,
        label: body.label,
        email: body.email ?? null,
        planId: body.planId,
        monthlyPriceCents: body.monthlyPriceCents ?? null,
        renewalDay: body.renewalDay ?? null,
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

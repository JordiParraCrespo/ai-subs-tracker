import { ApiAuthProblemResponses, ApiProblemResponse } from '@flama/backend-core';
import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { ArchiveAccountCommand } from './archive-account.command';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('accounts')
export class ArchiveAccountHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @HttpCode(204)
  @NoPolicy('removes one of the caller’s own accounts; ownership is checked on load')
  @Version('1')
  @RequireScopes('accounts:write')
  @ApiOperation({ summary: 'Stop tracking an account' })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Account not found', code: 'ACCOUNT_001' })
  async archive(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) accountId: string,
  ): Promise<void> {
    await this.commandBus.execute(new ArchiveAccountCommand({ userId, accountId }));
  }
}

import { ApiAuthProblemResponses, ApiProblemResponse } from '@flama/backend-core';
import { Body, Controller, HttpCode, Post, Req, Res, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import type { ReplacementSession } from '../../infrastructure/profile-auth.port';
import { ChangePasswordCommand } from './change-password.command';
import { ChangePasswordRequest } from './change-password.request.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class ChangePasswordHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('password')
  @NoPolicy('changes the caller’s own password')
  @Version('1')
  // Deliberately no `@RequireScopes`: the global `ScopesGuard` fails closed, so
  // omitting it makes this route reachable by a browser session only. An API
  // token that could rotate its owner's password would be a full account
  // takeover in the hands of anyone who leaked one.
  @HttpCode(204)
  // A wrong current password is the only signal an attacker with a stolen
  // session gets while guessing; keep the guessing slow.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Change the current user’s password',
    description:
      'Session-authenticated only — not reachable with an API token or OAuth credential.',
  })
  @ApiResponse({ status: 204, description: 'Password changed' })
  @ApiProblemResponse({
    status: 400,
    description: 'The current password is incorrect',
    code: 'PROFILE_002',
  })
  @ApiProblemResponse({
    status: 400,
    description: 'The new password does not meet the password policy',
    code: 'PROFILE_006',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async changePassword(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser('id') userId: string,
    @Body() body: ChangePasswordRequest,
  ): Promise<void> {
    const session = await this.commandBus.execute<ChangePasswordCommand, ReplacementSession>(
      new ChangePasswordCommand({
        headers: request.headers,
        userId,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: body.revokeOtherSessions ?? true,
      }),
    );
    // The caller's replacement session: a browser keeps the cookie, a client
    // without cookies reads the token, as it does from sign-in.
    if (session.cookies.length) response.append('Set-Cookie', session.cookies);
    if (session.bearerToken) response.setHeader('set-auth-token', session.bearerToken);
  }
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createDataRequestSchema, recordConsentSchema } from '@e3lani/types';
import { PrivacyService } from './privacy.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { ClientMeta, CurrentUser, RateLimit, type AuthUser } from '../../common/decorators';

@ApiTags('privacy')
@Controller('me/privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('consents')
  async consents(@CurrentUser() user: AuthUser) {
    return {
      records: await this.privacy.myConsents(user.id),
      pending: await this.privacy.pendingConsents(user.id),
    };
  }

  @Post('consents')
  async recordConsent(
    @CurrentUser() user: AuthUser,
    @Body(zodPipe(recordConsentSchema))
    body: { type: 'TERMS' | 'PRIVACY' | 'MARKETING'; version: string; granted: boolean },
    @ClientMeta() meta: { ip: string; userAgent: string | null },
  ) {
    await this.privacy.recordConsent(user.id, body.type, {
      ...meta,
      granted: body.granted,
      version: body.version,
    });
    return { ok: true };
  }

  @Get('data-requests')
  async myRequests(@CurrentUser() user: AuthUser) {
    return this.privacy.myRequests(user.id);
  }

  @Post('data-requests')
  @RateLimit({ limit: 3, windowSeconds: 86_400, by: 'user' })
  async createRequest(
    @CurrentUser() user: AuthUser,
    @Body(zodPipe(createDataRequestSchema)) body: { type: 'EXPORT' | 'DELETE'; note?: string },
  ) {
    return this.privacy.createRequest(user.id, body.type, body.note);
  }
}

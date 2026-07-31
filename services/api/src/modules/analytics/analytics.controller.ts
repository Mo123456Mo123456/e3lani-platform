import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { analyticsRangeSchema, trackEventsSchema } from '@e3lani/types';
import { AnalyticsService } from './analytics.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, OptionalAuth, RateLimit, type AuthUser } from '../../common/decorators';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@ApiTags('analytics')
@Controller()
@UseGuards(RateLimitGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @OptionalAuth()
  @Post('events')
  @HttpCode(202)
  @RateLimit({ limit: 240, windowSeconds: 300 })
  async track(@Body(zodPipe(trackEventsSchema)) body: any, @CurrentUser() user?: AuthUser) {
    return this.analytics.track(body.deviceId, body.events, user?.id ?? null);
  }

  @Get('ads/:id/analytics')
  async forAd(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(zodPipe(analyticsRangeSchema)) range: { from?: Date; to?: Date },
  ) {
    return this.analytics.forAd(user.id, id, range);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { feedQuerySchema } from '@e3lani/types';
import { FeedService, type FeedQuery } from './feed.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, OptionalAuth, RateLimit, type AuthUser } from '../../common/decorators';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@ApiTags('feed')
@Controller('feed')
@UseGuards(RateLimitGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @OptionalAuth()
  @Get()
  @RateLimit({ limit: 300, windowSeconds: 300 })
  async list(@Query(zodPipe(feedQuerySchema)) query: FeedQuery, @CurrentUser() user?: AuthUser) {
    return this.feed.feed(query, user?.id ?? null);
  }
}

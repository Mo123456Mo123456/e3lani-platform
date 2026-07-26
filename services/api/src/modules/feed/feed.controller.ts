import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FeedService } from './feed.service';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  forYou(@Query('cursor') cursor?: string, @Query('take') take?: string) {
    return this.feed.forYou(cursor, take ? Number(take) : 10);
  }

  @Get('latest')
  latest(@Query('cursor') cursor?: string, @Query('take') take?: string) {
    return this.feed.latest(cursor, take ? Number(take) : 10);
  }

  @Get('nearby')
  nearby(@Query('cursor') cursor?: string) {
    // Nearby requires location permission + geohash; falls back to for-you until coords provided.
    return this.feed.forYou(cursor, 10);
  }
}

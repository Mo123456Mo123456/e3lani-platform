import { Controller, Get, Headers, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTags } from '@nestjs/swagger';
import { feedSearchSchema } from '@e3lani/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { requireUserId } from '../../common/auth.util';
import { FeedService } from './feed.service';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(
    private readonly feed: FeedService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async forYou(
    @Headers('authorization') authorization: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
    @Query('cityId') cityId?: string,
  ) {
    let userId: string | undefined;
    if (authorization?.startsWith('Bearer ')) {
      try {
        const user = await requireUserId(this.jwt, authorization, this.prisma);
        userId = user.sub;
      } catch {
        userId = undefined;
      }
    }
    return this.feed.forYou({
      cursor,
      take: take ? Number(take) : 10,
      userId,
      cityId,
    });
  }

  @Get('latest')
  latest(@Query('cursor') cursor?: string, @Query('take') take?: string) {
    return this.feed.latest(cursor, take ? Number(take) : 10);
  }

  @Get('search')
  search(@Query() query: unknown) {
    const filters = feedSearchSchema.parse(query);
    return this.feed.search(filters);
  }

  @Get('nearby')
  nearby(
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
    @Query('cityId') cityId?: string,
  ) {
    return this.feed.nearby(cursor, take ? Number(take) : 10, cityId);
  }
}

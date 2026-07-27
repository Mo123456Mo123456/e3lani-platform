import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { requireActiveUser } from '../../common/auth.util';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('events')
  async events(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = authorization?.startsWith('Bearer ')
      ? await requireActiveUser(this.jwt, authorization, this.prisma)
      : undefined;
    return this.analytics.recordEvents(body, user?.sub);
  }

  @ApiBearerAuth()
  @Get('ads/:adId/summary')
  async adSummary(
    @Param('adId') adId: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    return this.analytics.adSummary(adId, user.sub);
  }

  @Post('jobs/daily-rollup')
  dailyRollup(@Headers('x-job-secret') jobSecret?: string, @Body() body?: { adIds?: string[] }) {
    this.assertJobSecret(jobSecret);
    return this.analytics.runDailyRollup(body?.adIds);
  }

  private assertJobSecret(header?: string) {
    const expected = process.env.JOB_SECRET;
    if (expected && header !== expected) {
      throw new UnauthorizedException('JOB_SECRET_INVALID');
    }
  }
}

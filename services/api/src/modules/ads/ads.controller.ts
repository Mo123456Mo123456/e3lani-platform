import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { scheduleAdSchema, shareAdSchema } from '@e3lani/validation';
import { requireUserId } from '../../common/auth.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AdsService } from './ads.service';

@ApiTags('ads')
@Controller('ads')
export class AdsController {
  constructor(
    private readonly ads: AdsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'List ads owned by the current user' })
  @ApiBearerAuth()
  @Get('mine')
  async mine(@Headers('authorization') authorization: string | undefined) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ads.listMine(user.sub);
  }

  @ApiOperation({ summary: 'Create a draft ad' })
  @ApiBearerAuth()
  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ads.createDraft(user.sub, body);
  }

  @ApiOperation({ summary: 'Run lifecycle job to expire due ads' })
  @Post('jobs/expire')
  expireJob(@Headers('x-job-secret') jobSecret?: string) {
    this.assertJobSecret(jobSecret);
    return this.ads.expireDueAds();
  }

  @ApiOperation({ summary: 'Run lifecycle job to activate scheduled ads' })
  @Post('jobs/activate-scheduled')
  activateScheduledJob(@Headers('x-job-secret') jobSecret?: string) {
    this.assertJobSecret(jobSecret);
    return this.ads.activateScheduled();
  }

  @ApiOperation({ summary: 'Get one ad by id' })
  @Get(':id')
  get(@Param('id') id: string) {
    return this.ads.getById(id);
  }

  @ApiOperation({ summary: 'Submit a draft ad for moderation review' })
  @ApiBearerAuth()
  @Post(':id/submit-review')
  async submitReview(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ads.submitReview(id, user.sub);
  }

  @ApiOperation({ summary: 'Create a new ad revision' })
  @ApiBearerAuth()
  @Post(':id/revisions')
  async revise(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ads.createRevision(id, user.sub, body);
  }

  @ApiOperation({ summary: 'Pause an active ad' })
  @ApiBearerAuth()
  @Post(':id/pause')
  async pause(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ads.pause(id, user.sub);
  }

  @ApiOperation({ summary: 'Resume a paused ad' })
  @ApiBearerAuth()
  @Post(':id/resume')
  async resume(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ads.resume(id, user.sub);
  }

  @ApiOperation({ summary: 'Schedule an approved or active ad' })
  @ApiBearerAuth()
  @Post(':id/schedule')
  async schedule(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    const input = scheduleAdSchema.parse(body);
    return this.ads.schedule(id, user.sub, new Date(input.scheduledAt));
  }

  @ApiOperation({ summary: 'Republish an expired ad' })
  @ApiBearerAuth()
  @Post(':id/republish')
  async republish(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ads.republish(id, user.sub);
  }

  @ApiOperation({ summary: 'Extend an active or paused ad in sandbox/staging' })
  @ApiBearerAuth()
  @Post(':id/extend')
  async extend(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ads.extend(id, user.sub);
  }

  @ApiOperation({ summary: 'Track an ad share and return a share URL' })
  @Post(':id/share')
  async share(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const input = shareAdSchema.parse(body ?? {});
    const user = authorization?.startsWith('Bearer ')
      ? await requireUserId(this.jwt, authorization, this.prisma)
      : undefined;
    return this.ads.share(id, user?.sub, input.channel);
  }

  private assertJobSecret(header?: string) {
    const expected = process.env.JOB_SECRET;
    if (expected && header !== expected) {
      throw new UnauthorizedException('JOB_SECRET_INVALID');
    }
  }
}

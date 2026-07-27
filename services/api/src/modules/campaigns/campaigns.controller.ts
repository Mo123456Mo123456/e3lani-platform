import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createCampaignSchema } from '@e3lani/validation';
import { CampaignStatus } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { requireActiveUser } from '../../common/auth.util';
import { CampaignsService } from './campaigns.service';

const campaignAdsSchema = z.object({
  adIds: z.array(z.string().uuid()).min(1),
});

const campaignStatusSchema = z.object({
  status: z.nativeEnum(CampaignStatus),
});

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    const input = createCampaignSchema.parse(body);
    return this.campaigns.create(user.sub, input);
  }

  @Get('mine')
  async mine(@Headers('authorization') authorization: string | undefined) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    return this.campaigns.mine(user.sub);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    return this.campaigns.get(id, user.sub);
  }

  @Post(':id/ads')
  async addAds(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    const input = campaignAdsSchema.parse(body);
    return this.campaigns.addAds(id, user.sub, input.adIds);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    const input = campaignStatusSchema.parse(body);
    return this.campaigns.updateStatus(id, user.sub, input.status);
  }
}

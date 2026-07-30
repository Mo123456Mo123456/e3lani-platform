import { Body, Controller, Get, Headers, Patch, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RecommendationWeights } from '@e3lani/recommendations';
import { assertRole, requireActiveUser, requireUserId } from '../../common/auth.util';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationsService } from './recommendations.service';

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendations: RecommendationsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('interactions')
  async interactions(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
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
    return this.recommendations.recordInteractions(body, userId);
  }

  @ApiBearerAuth()
  @Get('weights')
  async getWeights(@Headers('authorization') authorization?: string) {
    await this.authorizeAdmin(authorization);
    return this.recommendations.getWeights();
  }

  @ApiBearerAuth()
  @Patch('weights')
  async updateWeights(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Partial<RecommendationWeights>,
  ) {
    const user = await this.authorizeAdmin(authorization);
    return this.recommendations.updateWeights(user.sub, body);
  }

  @ApiBearerAuth()
  @Get('performance')
  async performance(@Headers('authorization') authorization?: string) {
    await this.authorizeAdmin(authorization);
    return this.recommendations.performanceReport();
  }

  private async authorizeAdmin(authorization?: string) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    if ((process.env.PAYMENT_MODE ?? 'sandbox') !== 'sandbox') {
      assertRole(user, ['SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'AD_MODERATOR']);
    }
    return user;
  }
}

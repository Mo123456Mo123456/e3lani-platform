import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createAppealSchema } from '@e3lani/validation';
import { AppealStatus } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { assertRole, requireActiveUser } from '../../common/auth.util';
import { AppealsService } from './appeals.service';

const decideAppealSchema = z.object({
  status: z.nativeEnum(AppealStatus),
  decisionNote: z.string().trim().max(2000).optional(),
});

@ApiTags('appeals')
@Controller()
export class AppealsController {
  constructor(
    private readonly appeals: AppealsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private async adminUser(authorization: string | undefined) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    const sandboxOpenAdmin = (process.env.PAYMENT_MODE ?? 'sandbox') === 'sandbox';
    if (!sandboxOpenAdmin) {
      assertRole(user, ['SUPER_ADMIN', 'AD_MODERATOR', 'SUPPORT']);
    }
    return user;
  }

  @ApiBearerAuth()
  @Post('appeals')
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    const input = createAppealSchema.parse(body);
    return this.appeals.create(user.sub, input);
  }

  @ApiBearerAuth()
  @Get('appeals/mine')
  async mine(@Headers('authorization') authorization: string | undefined) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    return this.appeals.mine(user.sub);
  }

  @ApiBearerAuth()
  @Get('admin/appeals')
  async adminList(@Headers('authorization') authorization: string | undefined) {
    await this.adminUser(authorization);
    return this.appeals.listAdmin();
  }

  @ApiBearerAuth()
  @Patch('admin/appeals/:id')
  async decide(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.adminUser(authorization);
    const input = decideAppealSchema.parse(body);
    return this.appeals.decide(id, user.sub, input);
  }
}

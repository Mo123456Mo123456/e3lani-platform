import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { reportAdSchema } from '@e3lani/validation';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { assertRole, requireActiveUser } from '../../common/auth.util';
import { ReportsService } from './reports.service';

const updateReportSchema = z.object({
  status: z.string().trim().min(1).max(80).optional(),
  resolution: z.string().trim().min(1).max(2000).optional(),
});

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiBearerAuth()
  @Post('ads/:adId/reports')
  async create(
    @Param('adId') adId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    const input = reportAdSchema.parse(body);
    return this.reports.create(adId, user.sub, input);
  }

  @ApiBearerAuth()
  @Get('reports/mine')
  async mine(@Headers('authorization') authorization: string | undefined) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    return this.reports.mine(user.sub);
  }

  @ApiBearerAuth()
  @Get('admin/reports')
  async adminList(@Headers('authorization') authorization: string | undefined) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    assertRole(user, ['SUPER_ADMIN', 'AD_MODERATOR', 'SUPPORT']);
    return this.reports.listAdmin();
  }

  @ApiBearerAuth()
  @Patch('admin/reports/:id')
  async adminResolve(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    assertRole(user, ['SUPER_ADMIN', 'AD_MODERATOR', 'SUPPORT']);
    const input = updateReportSchema.parse(body);
    return this.reports.resolve(id, user.sub, input);
  }
}

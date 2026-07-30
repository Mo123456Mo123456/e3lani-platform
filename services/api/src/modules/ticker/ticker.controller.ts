import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { assertRole, requireActiveUser, requireUserId } from '../../common/auth.util';
import { PrismaService } from '../../prisma/prisma.service';
import { TickerService } from './ticker.service';

@ApiTags('ticker')
@Controller('ticker')
export class TickerController {
  constructor(
    private readonly ticker: TickerService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Public active logos for the non-clickable strip. */
  @Get()
  listActive() {
    return this.ticker.listActive();
  }

  @ApiBearerAuth()
  @Get('mine')
  async mine(@Headers('authorization') authorization?: string) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ticker.listMine(user.sub);
  }

  @ApiBearerAuth()
  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ticker.create(user.sub, body);
  }

  @ApiBearerAuth()
  @Post(':id/submit')
  async submit(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.ticker.submit(id, user.sub);
  }

  @ApiBearerAuth()
  @Get('admin/list')
  async adminList(@Headers('authorization') authorization?: string) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    if ((process.env.PAYMENT_MODE ?? 'sandbox') !== 'sandbox') {
      assertRole(user, ['SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'AD_MODERATOR']);
    }
    return this.ticker.listAdmin();
  }

  @ApiBearerAuth()
  @Post('admin/:id/decide')
  async decide(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { status: 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'STOPPED'; reason?: string },
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    if ((process.env.PAYMENT_MODE ?? 'sandbox') !== 'sandbox') {
      assertRole(user, ['SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'AD_MODERATOR']);
    }
    return this.ticker.decide(id, user.sub, body.status, body.reason);
  }
}

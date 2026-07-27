import { Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { requireActiveUser } from '../../common/auth.util';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@Headers('authorization') authorization: string | undefined) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    return this.notifications.list(user.sub);
  }

  @Post(':id/read')
  async markRead(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    return this.notifications.markRead(user.sub, id);
  }

  @Post('read-all')
  async markAllRead(@Headers('authorization') authorization: string | undefined) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    return this.notifications.markAllRead(user.sub);
  }
}

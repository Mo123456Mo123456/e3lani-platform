import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { paginationSchema } from '@e3lani/types';
import { NotificationsService } from './notifications.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../../common/decorators';

const pushTokenSchema = z.object({
  token: z.string().min(10).max(300),
  platform: z.enum(['ios', 'android', 'web']),
});

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(zodPipe(paginationSchema)) query: { cursor?: string; limit: number },
  ) {
    return this.notifications.list(user.id, query);
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notifications.markRead(user.id, id);
    return { ok: true };
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    const count = await this.notifications.markAllRead(user.id);
    return { updated: count };
  }

  @Post('push-tokens')
  async registerToken(
    @CurrentUser() user: AuthUser,
    @Body(zodPipe(pushTokenSchema)) body: { token: string; platform: string },
  ) {
    await this.notifications.registerPushToken(user.id, body.token, body.platform);
    return { ok: true };
  }

  @Delete('push-tokens/:token')
  async removeToken(@Param('token') token: string) {
    await this.notifications.removePushToken(token);
    return { ok: true };
  }
}

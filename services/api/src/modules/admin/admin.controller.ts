import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { checkStorageHealth } from '@e3lani/storage';
import { assertRole, requireUserId } from '../../common/auth.util';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly jwt: JwtService,
  ) {}

  private async moderator(authorization?: string) {
    const user = await requireUserId(this.jwt, authorization);
    // Bootstrap: SUPER_ADMIN / AD_MODERATOR, or any authenticated user in sandbox for local review tests.
    const sandboxOpenReview = (process.env.PAYMENT_MODE ?? 'sandbox') === 'sandbox';
    if (!sandboxOpenReview) {
      assertRole(user, ['SUPER_ADMIN', 'AD_MODERATOR']);
    }
    return user;
  }

  @Get('ads/review')
  list(@Headers('authorization') authorization?: string) {
    return this.moderator(authorization).then(() => this.admin.listPendingReview());
  }

  @Get('orders')
  orders(@Headers('authorization') authorization?: string) {
    return this.moderator(authorization).then(() => this.admin.listOrders());
  }

  @Get('payments')
  payments(@Headers('authorization') authorization?: string) {
    return this.moderator(authorization).then(() => this.admin.listPayments());
  }

  /**
   * Storage provider health (no secrets). Confirms bucket reachability for R2/S3/MinIO.
   * GET /api/v1/admin/providers/storage/health
   */
  @Get('providers/storage/health')
  async storageHealth(@Headers('authorization') authorization?: string) {
    await this.moderator(authorization);
    return checkStorageHealth();
  }

  @Post('ads/:id/approve')
  async approve(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { notes?: string },
  ) {
    const user = await this.moderator(authorization);
    return this.admin.approve(id, user.sub, body.notes);
  }

  @Post('ads/:id/needs-changes')
  async needsChanges(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { notes: string },
  ) {
    if (!body.notes?.trim()) throw new BadRequestException('NOTES_REQUIRED');
    const user = await this.moderator(authorization);
    return this.admin.needsChanges(id, user.sub, body.notes);
  }

  @Post('ads/:id/reject')
  async reject(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { notes: string },
  ) {
    if (!body.notes?.trim()) throw new BadRequestException('NOTES_REQUIRED');
    const user = await this.moderator(authorization);
    return this.admin.reject(id, user.sub, body.notes);
  }
}

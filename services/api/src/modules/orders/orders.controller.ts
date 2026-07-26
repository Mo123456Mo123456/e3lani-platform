import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PlatformChannel } from '@e3lani/types';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly jwt: JwtService,
  ) {}

  private async userId(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('MISSING_TOKEN');
    }
    const payload = await this.jwt.verifyAsync<{ sub: string }>(
      authorization.slice('Bearer '.length),
    );
    return payload.sub;
  }

  @Get('ads/:id/payment-options')
  paymentOptions(
    @Param('id') id: string,
    @Query('platform') platform?: PlatformChannel,
  ) {
    return this.orders.paymentOptions(id, platform ?? 'web');
  }

  @ApiBearerAuth()
  @Post('orders')
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: { adId: string },
  ) {
    const userId = await this.userId(authorization);
    if (!idempotencyKey) {
      throw new UnauthorizedException('IDEMPOTENCY_KEY_REQUIRED');
    }
    return this.orders.createOrder({
      userId,
      adId: body.adId,
      idempotencyKey,
    });
  }
}

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
import { requireUserId } from '../../common/auth.util';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly jwt: JwtService,
  ) {}

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
    @Body()
    body: {
      adId: string;
      successUrl?: string;
      cancelUrl?: string;
      platform?: PlatformChannel;
    },
  ) {
    const user = await requireUserId(this.jwt, authorization);
    if (!idempotencyKey) {
      throw new UnauthorizedException('IDEMPOTENCY_KEY_REQUIRED');
    }
    return this.orders.createCheckout({
      userId: user.sub,
      adId: body.adId,
      idempotencyKey,
      successUrl: body.successUrl ?? 'http://localhost:3000/payment/success',
      cancelUrl: body.cancelUrl ?? 'http://localhost:3000/payment/cancel',
      platform: body.platform ?? 'web',
    });
  }

  @Post('orders/:id/verify-redirect')
  verifyRedirect(@Param('id') id: string) {
    // Intentionally does not activate — documents fail-closed redirect policy.
    return this.orders.rejectRedirectActivation(id);
  }
}

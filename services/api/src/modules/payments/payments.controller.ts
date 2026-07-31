import {
  Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { checkoutSchema, purchasePromotionSchema } from '@e3lani/types';
import { PaymentsService } from './payments.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, Public, RateLimit, type AuthUser } from '../../common/decorators';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@ApiTags('payments')
@Controller('payments')
@UseGuards(RateLimitGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('checkout')
  @RateLimit({ limit: 20, windowSeconds: 600, by: 'user' })
  async checkout(@CurrentUser() user: AuthUser, @Body(zodPipe(checkoutSchema)) body: any) {
    return this.payments.checkout(user.id, body);
  }

  /** شراء خدمة ترويج لإعلان — اختصار فوق نقطة الدفع العامة. */
  @Post('promotions')
  @RateLimit({ limit: 20, windowSeconds: 600, by: 'user' })
  async promote(
    @CurrentUser() user: AuthUser,
    @Body(zodPipe(purchasePromotionSchema)) body: { adId: string; type: string; extraCityIds?: string[] },
  ) {
    return this.payments.checkout(user.id, {
      items: [
        {
          pricingKey: body.type,
          adId: body.adId,
          quantity: 1,
          metadata: body.extraCityIds ? { extraCityIds: body.extraCityIds } : undefined,
        },
      ],
    });
  }

  @Get('mine')
  async mine(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.payments.listMine(user.id, Math.min(Number(limit ?? 20) || 20, 100));
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.get(user.id, id);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Headers() headers: Record<string, any>, @Req() request: Request) {
    const raw = (request as any).rawBody?.toString('utf8') ?? JSON.stringify(request.body ?? {});
    return this.payments.handleWebhook(headers, raw);
  }

  /** مسار تطويري فقط — يرفض العمل في الإنتاج أو مع مزوّد حقيقي. */
  @Public()
  @Post('sandbox/:id')
  @HttpCode(200)
  async sandboxConfirm(@Param('id') id: string) {
    return this.payments.confirmSandbox(id);
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { quoteSaudiSkus, routePayment, DEFAULT_PROVIDER_CATALOG } from '@e3lani/payments';
import type { PlatformChannel } from '@e3lani/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AdStateService } from '../../common/ad-state.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adState: AdStateService,
  ) {}

  async paymentOptions(adId: string, platform: PlatformChannel = 'web') {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException('AD_NOT_FOUND');
    if (ad.status !== 'APPROVED_AWAITING_PAYMENT' && ad.status !== 'PAYMENT_FAILED') {
      throw new BadRequestException('PAYMENT_ONLY_AFTER_APPROVAL');
    }
    if (!ad.approvedRevisionId || ad.approvedRevisionId !== ad.currentRevisionId) {
      throw new BadRequestException('PAYMENT_REQUIRES_APPROVED_CURRENT_REVISION');
    }

    const quote = quoteSaudiSkus(['AD_PUBLISH_30D']);
    const providers = await this.prisma.paymentProviderConfig.findMany();
    const catalog =
      providers.length > 0
        ? providers.map((p) => ({
            name: p.name,
            enabled: p.enabled,
            mode: p.mode as 'sandbox' | 'production',
            priority: p.priority,
            countries: p.countries,
            currencies: p.currencies as never[],
            channels: p.channels as never[],
          }))
        : DEFAULT_PROVIDER_CATALOG;

    const route = routePayment({
      countryCode: quote.countryCode,
      currency: quote.currency,
      platform,
      providers: catalog,
    });

    return {
      adId,
      revisionId: ad.approvedRevisionId,
      quote,
      routing: route,
      messageAr: route.ok
        ? undefined
        : 'لا يوجد مزود دفع متاح حاليًا. فعّل مزودًا من لوحة الإدارة بعد إدخال المفاتيح.',
    };
  }

  async createOrder(input: {
    userId: string;
    adId: string;
    idempotencyKey: string;
  }) {
    const options = await this.paymentOptions(input.adId, 'web');
    if (!options.routing.ok) {
      throw new BadRequestException(options.messageAr ?? 'NO_PAYMENT_PROVIDER');
    }

    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const pricing = await this.prisma.pricingVersion.findFirst({
      where: { isActive: true },
    });
    if (!pricing) throw new BadRequestException('PRICING_NOT_CONFIGURED');

    const order = await this.prisma.order.create({
      data: {
        userId: input.userId,
        adId: input.adId,
        revisionId: options.revisionId!,
        pricingVersionId: pricing.id,
        status: 'PENDING_PAYMENT',
        currency: options.quote.currency,
        countryCode: options.quote.countryCode,
        subtotal: options.quote.subtotal,
        taxAmount: options.quote.taxAmount,
        total: options.quote.total,
        idempotencyKey: input.idempotencyKey,
        items: {
          create: options.quote.lines.map((line) => ({
            sku: line.sku,
            labelAr: line.labelAr,
            labelEn: line.labelEn,
            quantity: line.quantity,
            amount: line.lineTotal,
          })),
        },
      },
      include: { items: true },
    });

    await this.adState.transition({
      adId: input.adId,
      to: 'PAYMENT_PENDING',
      actorId: input.userId,
      reason: 'Checkout started',
    });

    return order;
  }
}

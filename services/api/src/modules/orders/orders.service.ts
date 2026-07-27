import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { quoteSaudiSkus, routePayment, DEFAULT_PROVIDER_CATALOG } from '@e3lani/payments';
import type { PlatformChannel } from '@e3lani/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AdStateService } from '../../common/ad-state.service';
import { PaymentsProviderService } from '../payments/payments-provider.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adState: AdStateService,
    private readonly payments: PaymentsProviderService,
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
    expectQuoteIsApprovedPricing(quote.total);

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

  async createCheckout(input: {
    userId: string;
    adId: string;
    idempotencyKey: string;
    successUrl: string;
    cancelUrl: string;
    platform?: PlatformChannel;
  }) {
    const options = await this.paymentOptions(input.adId, input.platform ?? 'web');
    if (!options.routing.ok) {
      throw new BadRequestException(options.messageAr ?? 'NO_PAYMENT_PROVIDER');
    }

    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true, attempts: true },
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

    const provider = this.payments.getProvider(options.routing.provider.name);
    const checkout = await provider.createCheckout({
      orderId: order.id,
      amount: Number(order.total),
      currency: order.currency as 'SAR',
      countryCode: order.countryCode,
      channel: options.routing.channel,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: {
        adId: input.adId,
        revisionId: options.revisionId!,
      },
      idempotencyKey: input.idempotencyKey,
    });

    await this.prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        provider: checkout.provider,
        channel: options.routing.channel,
        providerReference: checkout.providerReference,
        status: 'checkout_created',
        idempotencyKey: `${input.idempotencyKey}:attempt`,
      },
    });

    return {
      order,
      checkout,
      activationPolicy:
        'Ad is NOT activated by redirect/success URL. Only verified provider webhook activates the ad.',
    };
  }

  /**
   * Explicitly rejected path: browser success redirect must never publish.
   */
  async rejectRedirectActivation(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');
    return {
      activated: false,
      orderId,
      adStatusUnchanged: true,
      message:
        'Redirect/success pages do not activate ads. Wait for a verified payment webhook.',
    };
  }
}

function expectQuoteIsApprovedPricing(total: number) {
  if (total !== 59) {
    throw new BadRequestException(
      `Unexpected publish price ${total}. Approved SA publish price is 59 SAR.`,
    );
  }
}

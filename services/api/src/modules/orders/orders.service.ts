import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  quoteSaudiSkus,
  routePayment,
  DEFAULT_PROVIDER_CATALOG,
  getRefundProvider,
  assertApprovedPublishTotal,
} from '@e3lani/payments';
import type { PlatformChannel } from '@e3lani/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AdStateService } from '../../common/ad-state.service';
import { AuditService } from '../../common/audit.service';
import { PaymentsProviderService } from '../payments/payments-provider.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adState: AdStateService,
    private readonly payments: PaymentsProviderService,
    private readonly audit: AuditService,
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
    try {
      assertApprovedPublishTotal(quote.total);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

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

  async refundOrder(input: {
    orderId: string;
    actorId: string;
    amount?: number;
    reason?: string;
    idempotencyKey?: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        attempts: { orderBy: { createdAt: 'desc' } },
        transactions: { orderBy: { createdAt: 'desc' } },
        ad: true,
      },
    });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');
    if (order.status === 'REFUNDED') {
      return { ok: true, order, duplicate: true };
    }
    if (order.status !== 'PAID') {
      throw new BadRequestException('ORDER_NOT_PAID');
    }

    const paidTransaction =
      order.transactions.find((transaction) => transaction.status === 'paid') ??
      order.transactions[0];
    const attempt = order.attempts.find((row) => row.providerReference);
    const providerName = paidTransaction?.provider ?? attempt?.provider;
    const providerReference = paidTransaction?.providerReference ?? attempt?.providerReference;
    if (!providerName || !providerReference) {
      throw new BadRequestException('PAYMENT_REFERENCE_NOT_FOUND');
    }

    const amount = input.amount ?? Number(order.total);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('REFUND_AMOUNT_INVALID');
    }
    if (amount > Number(order.total)) {
      throw new BadRequestException('REFUND_AMOUNT_EXCEEDS_ORDER_TOTAL');
    }

    const idempotencyKey = input.idempotencyKey ?? `${order.id}:refund`;
    const beforeStatus = order.status;
    const pending = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'REFUND_PENDING' },
      include: { items: true, attempts: true, transactions: true },
    });
    await this.audit.write({
      actorId: input.actorId,
      action: 'orders.refund.pending',
      entityType: 'order',
      entityId: order.id,
      before: { status: beforeStatus },
      after: { status: pending.status, amount, provider: providerName },
      reason: input.reason,
    });

    try {
      const refundProvider = getRefundProvider(this.payments.getProvider(providerName));
      const refund = await refundProvider.refundPayment({
        providerReference,
        amount,
        reason: input.reason,
        idempotencyKey,
      });

      const refunded = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: order.id },
          data: { status: amount === Number(order.total) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
          include: { items: true, attempts: true, transactions: true },
        });
        await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            provider: providerName,
            providerReference: refund.refundId,
            amount,
            currency: order.currency,
            status: refund.status,
            rawPayload: {
              type: 'refund',
              originalProviderReference: providerReference,
              refundId: refund.refundId,
              status: refund.status,
              reason: input.reason ?? null,
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: 'orders.refund.completed',
            entityType: 'order',
            entityId: order.id,
            before: { status: pending.status },
            after: {
              status: updated.status,
              refundId: refund.refundId,
              provider: providerName,
              amount,
            },
            reason: input.reason,
          },
        });
        return updated;
      });

      return {
        ok: true,
        order: refunded,
        refund,
        workflow: ['REFUND_PENDING', refunded.status],
      };
    } catch (error) {
      const restored = await this.prisma.order.update({
        where: { id: order.id },
        data: { status: beforeStatus },
      });
      await this.audit.write({
        actorId: input.actorId,
        action: 'orders.refund.failed',
        entityType: 'order',
        entityId: order.id,
        before: { status: pending.status },
        after: {
          status: restored.status,
          provider: providerName,
          error: error instanceof Error ? error.message : 'REFUND_FAILED',
        },
        reason: input.reason,
      });
      throw error;
    }
  }
}

import {
  BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PRICING_KEYS, halalasToSar } from '@e3lani/config';
import type { PaymentDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { AuditService } from '../../common/services/audit.service';
import { PricingService } from '../pricing/pricing.service';
import { PromotionsService, type PromotionKey } from '../promotions/promotions.service';
import { AdsService } from '../ads/ads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_PROVIDER } from './providers/payment.factory';
import type { PaymentProvider } from './providers/payment-provider.interface';

interface CheckoutItem {
  pricingKey: string;
  adId?: string;
  tickerRequestId?: string;
  quantity: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly pricing: PricingService,
    private readonly promotions: PromotionsService,
    private readonly ads: AdsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  private toDto(payment: any): PaymentDto {
    return {
      id: payment.id,
      amountHalalas: payment.amountHalalas,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      providerRef: payment.providerRef,
      checkoutUrl: payment.checkoutUrl,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    };
  }

  /** إنشاء عملية دفع. تعمل فقط عندما يكون الدفع مفعّلًا من لوحة الإدارة. */
  async checkout(
    userId: string,
    input: { items: CheckoutItem[]; returnUrl?: string },
  ): Promise<PaymentDto> {
    if (!(await this.settings.paymentsEnabled())) {
      throw new ConflictException({
        message: 'الدفع غير مفعّل حاليًا — النشر مجاني',
        code: 'PAYMENTS_DISABLED',
      });
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, phone: true, name: true, email: true },
    });

    let total = 0;
    const resolvedItems: (CheckoutItem & { amountHalalas: number; nameAr: string })[] = [];

    for (const item of input.items) {
      const pricingItem = await this.pricing.require(item.pricingKey);
      if (item.adId) await this.assertAdOwnership(userId, item.adId);
      if (item.tickerRequestId) await this.assertTickerOwnership(userId, item.tickerRequestId);

      const amount = pricingItem.amountHalalas * item.quantity;
      total += amount;
      resolvedItems.push({
        ...item,
        amountHalalas: amount,
        nameAr: pricingItem.nameAr,
      });
    }

    if (total <= 0) {
      throw new BadRequestException({ message: 'قيمة العملية غير صالحة', code: 'INVALID_AMOUNT' });
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        adId: resolvedItems.find((item) => item.adId)?.adId ?? null,
        tickerRequestId: resolvedItems.find((item) => item.tickerRequestId)?.tickerRequestId ?? null,
        amountHalalas: total,
        currency: this.config.get<string>('PAYMENT_CURRENCY') ?? 'SAR',
        provider: this.provider.name,
        status: 'PENDING',
        items: resolvedItems as any,
      },
    });

    try {
      const checkout = await this.provider.createCheckout({
        paymentId: payment.id,
        amountHalalas: total,
        currency: payment.currency,
        description: resolvedItems.map((item) => item.nameAr).join('، '),
        customer: user,
        returnUrl:
          input.returnUrl ??
          this.config.get<string>('PAYMENT_RETURN_URL') ??
          'http://localhost:3000/payments/callback',
        metadata: { userId },
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: checkout.providerRef,
          checkoutUrl: checkout.checkoutUrl,
          meta: (checkout.clientData ?? null) as any,
        },
      });

      return this.toDto(updated);
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: (error as Error).message },
      });
      throw new BadRequestException({
        message: 'تعذّر بدء عملية الدفع، حاول لاحقًا',
        code: 'PAYMENT_INIT_FAILED',
      });
    }
  }

  async handleWebhook(headers: Record<string, any>, rawBody: string): Promise<{ handled: boolean }> {
    const result = await this.provider.parseWebhook(headers, rawBody);
    if (result.status === 'IGNORED') return { handled: false };

    const payment = await this.prisma.payment.findFirst({
      where: result.paymentId
        ? { id: result.paymentId }
        : { provider: this.provider.name, providerRef: result.providerRef },
    });

    if (!payment) {
      this.logger.warn(`لم يُعثر على عملية دفع مطابقة (${result.providerRef})`);
      return { handled: false };
    }

    if (payment.status === 'PAID' && result.status === 'PAID') return { handled: true };

    if (result.status === 'PAID') {
      if (result.amountHalalas && result.amountHalalas !== payment.amountHalalas) {
        this.logger.error(
          `قيمة الدفع لا تطابق العملية ${payment.id}: ${result.amountHalalas} ≠ ${payment.amountHalalas}`,
        );
        return { handled: false };
      }
      await this.markPaid(payment.id);
    } else if (result.status === 'FAILED') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: result.failureReason ?? null },
      });
      await this.notifications.notify(payment.userId, 'PAYMENT_FAILED', {
        titleAr: 'فشلت عملية الدفع',
        titleEn: 'Payment failed',
        bodyAr: 'لم تكتمل عملية الدفع، يمكنك إعادة المحاولة.',
        bodyEn: 'Your payment did not complete. You can try again.',
        data: { paymentId: payment.id },
      });
    } else if (result.status === 'REFUNDED') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });
    } else if (result.status === 'CANCELLED') {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } });
    }

    return { handled: true };
  }

  /** يعلّم العملية مدفوعة ثم ينفّذ ما تم شراؤه. */
  async markPaid(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'PAID', paidAt: new Date() },
    });

    await this.audit.record({
      action: 'payment.paid',
      entityType: 'Payment',
      entityId: payment.id,
      actorUserId: payment.userId,
      after: { amountHalalas: payment.amountHalalas },
    });

    await this.fulfil(payment);

    await this.notifications.notify(payment.userId, 'PAYMENT_SUCCEEDED', {
      titleAr: 'تم استلام الدفع',
      titleEn: 'Payment received',
      bodyAr: `تم استلام مبلغ ${halalasToSar(payment.amountHalalas)} ريال بنجاح.`,
      bodyEn: `We received your payment of SAR ${halalasToSar(payment.amountHalalas)}.`,
      data: { paymentId: payment.id },
    });
  }

  private async fulfil(payment: any): Promise<void> {
    const items = (payment.items ?? []) as CheckoutItem[];

    for (const item of items) {
      if (item.pricingKey === PRICING_KEYS.AD_STANDARD && item.adId) {
        await this.ads.activate(item.adId, payment.userId, `payment:${payment.id}`);
        continue;
      }

      if (item.pricingKey === PRICING_KEYS.TICKER_LOGO && item.tickerRequestId) {
        // بعد الدفع ينتقل طلب الشريط إلى المراجعة (شعارات الشريط تُراجع بشريًا)
        await this.prisma.tickerRequest.update({
          where: { id: item.tickerRequestId },
          data: { status: 'PENDING_REVIEW' },
        });
        continue;
      }

      if (PromotionsService.isPromotionKey(item.pricingKey) && item.adId) {
        await this.promotions.apply(item.adId, item.pricingKey as PromotionKey, {
          paymentId: payment.id,
          extraCityIds: item.metadata?.extraCityIds,
        });
      }
    }
  }

  async listMine(userId: string, limit = 20) {
    const rows = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => this.toDto(row));
  }

  async get(userId: string, paymentId: string): Promise<PaymentDto> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!payment) throw new NotFoundException({ message: 'العملية غير موجودة', code: 'PAYMENT_NOT_FOUND' });
    return this.toDto(payment);
  }

  /** تأكيد تجريبي للتطوير فقط — يرفض العمل خارج مزوّد sandbox. */
  async confirmSandbox(paymentId: string): Promise<PaymentDto> {
    if (this.provider.name !== 'sandbox' || process.env.NODE_ENV === 'production') {
      throw new ForbiddenException({ message: 'غير متاح', code: 'NOT_AVAILABLE' });
    }
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException({ message: 'العملية غير موجودة', code: 'PAYMENT_NOT_FOUND' });
    if (payment.status !== 'PAID') await this.markPaid(paymentId);
    return this.get(payment.userId, paymentId);
  }

  private async assertAdOwnership(userId: string, adId: string): Promise<void> {
    const ad = await this.prisma.ad.findFirst({ where: { id: adId, userId }, select: { id: true } });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });
  }

  private async assertTickerOwnership(userId: string, requestId: string): Promise<void> {
    const request = await this.prisma.tickerRequest.findFirst({
      where: { id: requestId, userId },
      select: { id: true },
    });
    if (!request) {
      throw new NotFoundException({ message: 'طلب الشريط غير موجود', code: 'TICKER_NOT_FOUND' });
    }
  }
}

import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AD_POLICY } from '@e3lani/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AdStateService } from '../../common/ad-state.service';
import { PaymentsProviderService } from '../payments/payments-provider.service';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adState: AdStateService,
    private readonly payments: PaymentsProviderService,
  ) {}

  async handlePaymentWebhook(
    providerName: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ) {
    const provider = this.payments.getProvider(providerName);
    const valid = await provider.verifyWebhookSignature({ headers, rawBody });
    if (!valid) {
      throw new UnauthorizedException('WEBHOOK_SIGNATURE_INVALID');
    }

    const event = await provider.parseWebhook({ headers, rawBody });

    // Idempotency via unique (provider, eventId)
    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_eventId: { provider: providerName, eventId: event.eventId },
      },
    });
    if (existing?.processed) {
      return { ok: true, duplicate: true, eventId: event.eventId };
    }

    await this.prisma.paymentWebhookEvent.upsert({
      where: {
        provider_eventId: { provider: providerName, eventId: event.eventId },
      },
      create: {
        provider: providerName,
        eventId: event.eventId,
        payload: JSON.parse(rawBody.toString('utf8')),
        processed: false,
      },
      update: {},
    });

    if (!event.paid || !event.orderId) {
      return { ok: true, activated: false, reason: 'NOT_PAID' };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      include: { ad: true },
    });
    if (!order) throw new BadRequestException('ORDER_NOT_FOUND');

    // Server-side verify with provider before activation
    const verified = await provider.verifyPayment({
      providerReference: event.providerReference,
      orderId: order.id,
    });
    if (!verified.paid) {
      throw new BadRequestException('PROVIDER_VERIFY_FAILED');
    }

    if (order.ad.approvedRevisionId !== order.revisionId) {
      throw new BadRequestException('PAYMENT_FOR_STALE_REVISION');
    }
    if (order.ad.currentRevisionId !== order.revisionId) {
      throw new BadRequestException('PAYMENT_FOR_NON_CURRENT_REVISION');
    }

    const existingTxn = await this.prisma.paymentTransaction.findUnique({
      where: {
        provider_providerReference: {
          provider: providerName,
          providerReference: event.providerReference,
        },
      },
    });

    // Idempotent: same provider reference already paid/activated
    if (existingTxn || order.status === 'PAID' || order.ad.status === 'ACTIVE') {
      await this.prisma.paymentWebhookEvent.update({
        where: {
          provider_eventId: { provider: providerName, eventId: event.eventId },
        },
        data: { processed: true },
      });
      return {
        ok: true,
        activated: true,
        duplicate: true,
        adId: order.adId,
        orderId: order.id,
        eventId: event.eventId,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID' },
      });
      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: providerName,
          providerReference: event.providerReference,
          amount: order.total,
          currency: order.currency,
          status: 'paid',
          rawPayload: JSON.parse(rawBody.toString('utf8')),
        },
      });
      await tx.paymentWebhookEvent.update({
        where: {
          provider_eventId: { provider: providerName, eventId: event.eventId },
        },
        data: { processed: true },
      });
    });

    const publishedAt = new Date();
    const expiresAt = new Date(
      publishedAt.getTime() + AD_POLICY.defaultDurationDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.ad.update({
      where: { id: order.adId },
      data: {
        activeRevisionId: order.revisionId,
        publishedAt,
        expiresAt,
      },
    });

    await this.adState.transition({
      adId: order.adId,
      to: 'ACTIVE',
      reason: `Activated via verified ${providerName} webhook ${event.eventId}`,
    });

    return {
      ok: true,
      activated: true,
      adId: order.adId,
      orderId: order.id,
      eventId: event.eventId,
    };
  }
}

import { Logger } from '@nestjs/common';
import type {
  CheckoutRequest, CheckoutResponse, PaymentProvider, WebhookResult,
} from './payment-provider.interface';

/** مزوّد «هايبر باي» — https://hyperpay.com */
export class HyperpayPaymentProvider implements PaymentProvider {
  readonly name = 'hyperpay';
  private readonly logger = new Logger('Payments:hyperpay');
  private readonly baseUrl = 'https://eu-prod.oppwa.com/v1';

  constructor(
    private readonly entityId: string,
    private readonly accessToken: string,
  ) {}

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const body = new URLSearchParams({
      entityId: this.entityId,
      amount: (request.amountHalalas / 100).toFixed(2),
      currency: request.currency,
      paymentType: 'DB',
      merchantTransactionId: request.paymentId,
    });

    const response = await fetch(`${this.baseUrl}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      this.logger.error(`فشل إنشاء الجلسة: ${response.status}`);
      throw new Error('PAYMENT_PROVIDER_ERROR');
    }

    const checkout = (await response.json()) as { id: string };
    return {
      providerRef: checkout.id,
      checkoutUrl: null,
      clientData: { checkoutId: checkout.id, entityId: this.entityId },
    };
  }

  async parseWebhook(_headers: Record<string, any>, rawBody: string): Promise<WebhookResult> {
    const payload = JSON.parse(rawBody || '{}');
    const code = String(payload.result?.code ?? '');
    const success = /^(000\.000\.|000\.100\.1|000\.[36])/.test(code);
    return {
      providerRef: payload.id ?? '',
      paymentId: payload.merchantTransactionId,
      status: success ? 'PAID' : 'FAILED',
      amountHalalas: payload.amount ? Math.round(Number(payload.amount) * 100) : undefined,
      failureReason: success ? undefined : payload.result?.description,
    };
  }

  async refund(providerRef: string, amountHalalas: number): Promise<boolean> {
    const body = new URLSearchParams({
      entityId: this.entityId,
      amount: (amountHalalas / 100).toFixed(2),
      currency: 'SAR',
      paymentType: 'RF',
    });
    const response = await fetch(`${this.baseUrl}/payments/${providerRef}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    return response.ok;
  }
}

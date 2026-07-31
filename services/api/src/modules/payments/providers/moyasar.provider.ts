import { Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CheckoutRequest, CheckoutResponse, PaymentProvider, WebhookResult,
} from './payment-provider.interface';

/** مزوّد «ميسر» — https://moyasar.com (يدعم مدى وApple Pay والبطاقات). */
export class MoyasarPaymentProvider implements PaymentProvider {
  readonly name = 'moyasar';
  private readonly logger = new Logger('Payments:moyasar');
  private readonly baseUrl = 'https://api.moyasar.com/v1';

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string | undefined,
  ) {}

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`;
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const response = await fetch(`${this.baseUrl}/invoices`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: request.amountHalalas,
        currency: request.currency,
        description: request.description,
        callback_url: request.returnUrl,
        metadata: { paymentId: request.paymentId, ...request.metadata },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`فشل إنشاء الفاتورة: ${response.status} ${text}`);
      throw new Error('PAYMENT_PROVIDER_ERROR');
    }

    const invoice = (await response.json()) as { id: string; url: string };
    return { providerRef: invoice.id, checkoutUrl: invoice.url };
  }

  async parseWebhook(headers: Record<string, any>, rawBody: string): Promise<WebhookResult> {
    if (this.webhookSecret) {
      const signature = String(headers['x-moyasar-signature'] ?? '');
      const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        this.logger.warn('توقيع webhook غير صالح');
        return { providerRef: '', status: 'IGNORED' };
      }
    }

    const payload = JSON.parse(rawBody || '{}');
    const data = payload.data ?? payload;
    const statusMap: Record<string, WebhookResult['status']> = {
      paid: 'PAID',
      failed: 'FAILED',
      refunded: 'REFUNDED',
      voided: 'CANCELLED',
    };

    return {
      providerRef: data.id ?? data.invoice_id ?? '',
      paymentId: data.metadata?.paymentId,
      status: statusMap[data.status] ?? 'IGNORED',
      amountHalalas: data.amount,
      failureReason: data.source?.message,
    };
  }

  async refund(providerRef: string, amountHalalas: number): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/payments/${providerRef}/refund`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountHalalas }),
    });
    return response.ok;
  }
}

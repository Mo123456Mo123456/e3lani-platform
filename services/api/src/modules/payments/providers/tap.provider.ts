import { Logger } from '@nestjs/common';
import type {
  CheckoutRequest, CheckoutResponse, PaymentProvider, WebhookResult,
} from './payment-provider.interface';

/** مزوّد «تاب» — https://tap.company */
export class TapPaymentProvider implements PaymentProvider {
  readonly name = 'tap';
  private readonly logger = new Logger('Payments:tap');
  private readonly baseUrl = 'https://api.tap.company/v2';

  constructor(private readonly secretKey: string) {}

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const response = await fetch(`${this.baseUrl}/charges`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: request.amountHalalas / 100,
        currency: request.currency,
        description: request.description,
        reference: { transaction: request.paymentId },
        customer: {
          first_name: request.customer.name ?? 'عميل',
          email: request.customer.email ?? undefined,
          phone: { country_code: '966', number: request.customer.phone.replace(/^966/, '') },
        },
        source: { id: 'src_all' },
        redirect: { url: request.returnUrl },
        metadata: { paymentId: request.paymentId },
      }),
    });

    if (!response.ok) {
      this.logger.error(`فشل إنشاء عملية الدفع: ${response.status} ${await response.text()}`);
      throw new Error('PAYMENT_PROVIDER_ERROR');
    }

    const charge = (await response.json()) as { id: string; transaction?: { url?: string } };
    return { providerRef: charge.id, checkoutUrl: charge.transaction?.url ?? null };
  }

  async parseWebhook(_headers: Record<string, any>, rawBody: string): Promise<WebhookResult> {
    const payload = JSON.parse(rawBody || '{}');
    const statusMap: Record<string, WebhookResult['status']> = {
      CAPTURED: 'PAID',
      FAILED: 'FAILED',
      DECLINED: 'FAILED',
      CANCELLED: 'CANCELLED',
      REFUNDED: 'REFUNDED',
    };
    return {
      providerRef: payload.id ?? '',
      paymentId: payload.metadata?.paymentId,
      status: statusMap[payload.status] ?? 'IGNORED',
      amountHalalas: payload.amount ? Math.round(payload.amount * 100) : undefined,
      failureReason: payload.response?.message,
    };
  }

  async refund(providerRef: string, amountHalalas: number): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/refunds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ charge_id: providerRef, amount: amountHalalas / 100, currency: 'SAR' }),
    });
    return response.ok;
  }
}

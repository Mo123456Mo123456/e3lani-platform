import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type { CurrencyCode } from '@e3lani/types';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  GetPaymentStatusInput,
  ParseWebhookInput,
  ParsedWebhookEvent,
  PaymentProvider,
  PaymentStatusResult,
  ProviderHealth,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  VerifyWebhookSignatureInput,
} from './provider';

type SandboxPaymentRecord = {
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  status: 'created' | 'paid' | 'refunded';
  paidAt?: string;
};

/**
 * Documented sandbox hosted-checkout provider.
 * Redirect success pages NEVER activate ads — only signed webhooks do.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly providerName = 'sandbox';
  readonly supportedCountries = ['SA', 'AE', 'KW', 'BH', 'QA', 'OM', '*'] as const;
  readonly supportedCurrencies = ['SAR', 'AED', 'USD'] as const;
  readonly supportedChannels = ['hosted_checkout'] as const;

  private readonly payments = new Map<string, SandboxPaymentRecord>();

  constructor(
    private readonly webhookSecret: string,
    private readonly publicBaseUrl = 'http://localhost:3001',
  ) {
    if (!webhookSecret) {
      throw new Error('SANDBOX_PAYMENT_WEBHOOK_SECRET is required');
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const providerReference = `sandbox_pay_${randomUUID()}`;
    this.payments.set(providerReference, {
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      status: 'created',
    });

    // Checkout URL is informational. Completing payment requires posting a signed webhook.
    const checkoutUrl = `${this.publicBaseUrl}/api/v1/payments/sandbox/checkout?orderId=${encodeURIComponent(
      input.orderId,
    )}&ref=${encodeURIComponent(providerReference)}&redirect=${encodeURIComponent(input.successUrl)}`;

    return {
      provider: this.providerName,
      checkoutUrl,
      providerReference,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  /** Simulates provider capture for sandbox tooling — still does not activate ads by itself. */
  markPaid(providerReference: string): void {
    const payment = this.payments.get(providerReference);
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    payment.status = 'paid';
    payment.paidAt = new Date().toISOString();
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const payment = this.payments.get(input.providerReference);
    if (!payment || payment.orderId !== input.orderId) {
      return { paid: false, status: 'not_found' };
    }
    return {
      paid: payment.status === 'paid',
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const payment = this.payments.get(input.providerReference);
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    payment.status = 'refunded';
    return { refundId: `sandbox_refund_${randomUUID()}`, status: 'refunded' };
  }

  signPayload(rawBody: string, timestamp: string, secret = this.webhookSecret): string {
    return createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
  }

  private signatureSecrets(): string[] {
    const secrets = [this.webhookSecret];
    // Staging smoke uses a documented alias so client-signed webhooks work even when
    // the live Render secret was previously generateValue'd.
    const alias = process.env.SANDBOX_PAYMENT_WEBHOOK_SECRET_ALIAS?.trim();
    const stagingKnown = 'e3lani-staging-sandbox-webhook-secret';
    const appEnv = (process.env.APP_ENV ?? '').toLowerCase();
    if (alias) secrets.push(alias);
    if (appEnv === 'staging') {
      secrets.push(stagingKnown);
    }
    return [...new Set(secrets.filter(Boolean))];
  }

  async verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean> {
    const signatureHeader = input.headers['x-e3lani-signature'] ?? input.headers['X-E3lani-Signature'];
    const timestampHeader = input.headers['x-e3lani-timestamp'] ?? input.headers['X-E3lani-Timestamp'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
    if (!signature || !timestamp) return false;

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    // 5-minute replay window
    if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;

    const rawBody = typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8');
    const a = Buffer.from(signature);
    for (const secret of this.signatureSecrets()) {
      const expected = this.signPayload(rawBody, timestamp, secret);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
    return false;
  }

  async parseWebhook(input: ParseWebhookInput): Promise<ParsedWebhookEvent> {
    const rawBody = typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8');
    const payload = JSON.parse(rawBody) as {
      eventId: string;
      type: string;
      providerReference: string;
      orderId: string;
      paid: boolean;
      occurredAt?: string;
    };

    if (!payload.eventId || !payload.providerReference || !payload.orderId) {
      throw new Error('INVALID_WEBHOOK_PAYLOAD');
    }

    return {
      eventId: payload.eventId,
      type: payload.type ?? 'payment.updated',
      providerReference: payload.providerReference,
      orderId: payload.orderId,
      paid: Boolean(payload.paid),
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
    };
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<PaymentStatusResult> {
    const payment = this.payments.get(input.providerReference);
    if (!payment) return { status: 'not_found', paid: false };
    return { status: payment.status, paid: payment.status === 'paid' };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      healthy: true,
      message: 'sandbox provider',
      checkedAt: new Date().toISOString(),
    };
  }
}

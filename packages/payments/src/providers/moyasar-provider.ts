import { createHmac, timingSafeEqual } from 'crypto';
import type { CurrencyCode, PaymentChannel } from '@e3lani/types';
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
} from '../provider';
import { ProductionPaymentProviderNotConfiguredError } from './production-stub';

export type MoyasarPaymentProviderOptions = {
  env?: NodeJS.ProcessEnv;
  apiBaseUrl?: string;
};

type MoyasarPaymentSource = {
  type?: string;
  transaction_url?: string;
  redirect_url?: string;
  url?: string;
  message?: string;
};

type MoyasarPaymentResponse = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: CurrencyCode;
  checkout_url?: string;
  payment_url?: string;
  redirect_url?: string;
  transaction_url?: string;
  invoice_url?: string;
  invoice_id?: string;
  url?: string;
  callback_url?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
  source?: MoyasarPaymentSource;
};

type MoyasarWebhookPayload = {
  id?: string;
  type?: string;
  event?: string;
  created_at?: string;
  data?: MoyasarPaymentResponse;
  metadata?: Record<string, unknown>;
  status?: string;
};

const REQUIRED_KEYS = [
  'MOYASAR_SECRET_KEY',
  'MOYASAR_PUBLISHABLE_KEY',
  'MOYASAR_WEBHOOK_SECRET',
] as const;

const DEFAULT_API_BASE_URL = 'https://api.moyasar.com/v1';
const DEFAULT_CHECKOUT_BASE_URL = 'https://moyasar.com';

export class MoyasarPaymentProvider implements PaymentProvider {
  readonly providerName = 'moyasar';
  readonly supportedCountries = ['SA', 'AE', 'KW', 'BH', 'QA', 'OM'] as const;
  readonly supportedCurrencies = ['SAR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR', 'USD'] as const;
  readonly supportedChannels = ['hosted_checkout'] as readonly PaymentChannel[];

  private readonly env: NodeJS.ProcessEnv;
  private readonly apiBaseUrl: string;

  constructor(options: MoyasarPaymentProviderOptions = {}) {
    this.env = options.env ?? process.env;
    this.apiBaseUrl = normalizeBaseUrl(
      options.apiBaseUrl ?? this.env.MOYASAR_API_BASE_URL ?? DEFAULT_API_BASE_URL,
    );
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    this.assertConfigured();
    const metadata = this.buildMetadata(input);
    const payment = await this.request<MoyasarPaymentResponse>(
      'POST',
      '/payments',
      {
        amount: toMinorUnits(input.amount, input.currency),
        currency: input.currency,
        description: `E3lani order ${input.orderId}`,
        callback_url: input.successUrl,
        source: {
          type: toMoyasarSourceType(input.channel),
        },
        metadata,
      },
      input.idempotencyKey,
    );

    const providerReference = requireMoyasarId(payment);
    const checkoutUrl = extractCheckoutUrl(payment) ?? buildInvoiceStyleUrl(payment, providerReference);
    const result: CreateCheckoutResult = {
      provider: this.providerName,
      providerReference,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
    if (checkoutUrl) {
      result.checkoutUrl = checkoutUrl;
    }
    return result;
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    this.assertConfigured(['MOYASAR_SECRET_KEY']);
    const payment = await this.fetchPayment(input.providerReference);
    const status = normalizeStatus(payment.status);
    const orderId = readMetadataValue(payment.metadata, 'orderId');
    const orderMatches = !orderId || orderId === input.orderId;
    const result: VerifyPaymentResult = {
      paid: status === 'paid' && orderMatches,
      status: orderMatches ? status : 'order_mismatch',
    };
    if (payment.status) {
      result.rawStatus = payment.status;
    }
    if (typeof payment.amount === 'number' && payment.currency) {
      result.amount = fromMinorUnits(payment.amount, payment.currency);
    }
    if (payment.currency) {
      result.currency = payment.currency;
    }
    return result;
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<PaymentStatusResult> {
    this.assertConfigured(['MOYASAR_SECRET_KEY']);
    const payment = await this.fetchPayment(input.providerReference);
    const status = normalizeStatus(payment.status);
    return { status, paid: status === 'paid' };
  }

  async parseWebhook(input: ParseWebhookInput): Promise<ParsedWebhookEvent> {
    const rawBody = rawBodyToString(input.rawBody);
    const payload = JSON.parse(rawBody) as MoyasarWebhookPayload;
    const payment: MoyasarPaymentResponse = payload.data ?? payload;
    const providerReference = payment.id;
    const status = normalizeStatus(payment.status);
    if (!payload.id || !providerReference) {
      throw new Error('INVALID_MOYASAR_WEBHOOK_PAYLOAD');
    }

    const event: ParsedWebhookEvent = {
      eventId: payload.id,
      type: payload.type ?? payload.event ?? `payment.${status}`,
      providerReference,
      paid: status === 'paid',
      occurredAt: payment.updated_at ?? payment.created_at ?? payload.created_at ?? new Date().toISOString(),
    };
    const orderId = readMetadataValue(payment.metadata ?? payload.metadata, 'orderId');
    if (orderId) {
      event.orderId = orderId;
    }
    return event;
  }

  async verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean> {
    const webhookSecret = this.env.MOYASAR_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      throw new ProductionPaymentProviderNotConfiguredError(
        this.providerName,
        'missing MOYASAR_WEBHOOK_SECRET',
      );
    }

    const signature = getHeader(input.headers, 'x-moyasar-signature');
    const token =
      getHeader(input.headers, 'x-moyasar-webhook-secret') ??
      getHeader(input.headers, 'x-webhook-secret') ??
      getHeader(input.headers, 'moyasar-webhook-secret');

    if (signature) {
      const rawBody = Buffer.isBuffer(input.rawBody)
        ? input.rawBody
        : Buffer.from(input.rawBody, 'utf8');
      const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      if (
        timingSafeStringEqual(signature, expected) ||
        timingSafeStringEqual(signature, `sha256=${expected}`)
      ) {
        return true;
      }

      // Some Moyasar webhook configurations use the shared secret directly as a token.
      if (timingSafeStringEqual(signature, webhookSecret)) {
        return true;
      }
    }

    return token ? timingSafeStringEqual(token, webhookSecret) : false;
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.assertConfigured(['MOYASAR_SECRET_KEY']);
    const body: Record<string, unknown> = {};
    if (typeof input.amount === 'number') {
      body.amount = toMinorUnits(input.amount, 'SAR');
    }
    if (input.reason) {
      body.reason = input.reason;
    }

    const refund = await this.request<{ id?: string; status?: string }>(
      'POST',
      `/payments/${encodeURIComponent(input.providerReference)}/refund`,
      body,
      input.idempotencyKey,
    );

    if (!refund.id) {
      throw new Error('MOYASAR_REFUND_RESPONSE_MISSING_ID');
    }
    return { refundId: refund.id, status: normalizeStatus(refund.status) };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const missing = this.missingKeys();
    return {
      healthy: missing.length === 0,
      message:
        missing.length === 0
          ? 'moyasar provider configured'
          : `moyasar provider missing keys: ${missing.join(', ')}`,
      checkedAt: new Date().toISOString(),
    };
  }

  private async fetchPayment(providerReference: string): Promise<MoyasarPaymentResponse> {
    return this.request<MoyasarPaymentResponse>(
      'GET',
      `/payments/${encodeURIComponent(providerReference)}`,
    );
  }

  private buildMetadata(input: CreateCheckoutInput): Record<string, string> {
    return {
      ...input.metadata,
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      publishableKey: this.env.MOYASAR_PUBLISHABLE_KEY?.trim() ?? '',
    };
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    const secretKey = this.env.MOYASAR_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new ProductionPaymentProviderNotConfiguredError(
        this.providerName,
        'missing MOYASAR_SECRET_KEY',
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      Accept: 'application/json',
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const requestInit: RequestInit = {
      method,
      headers,
    };
    if (body) {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, requestInit);

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = response.statusText;
      }
      throw new Error(`MOYASAR_API_ERROR:${response.status}:${errorBody}`);
    }

    return (await response.json()) as T;
  }

  private assertConfigured(keys: readonly (typeof REQUIRED_KEYS)[number][] = REQUIRED_KEYS): void {
    const missing = keys.filter((key) => !this.env[key]?.trim());
    if (missing.length > 0) {
      throw new ProductionPaymentProviderNotConfiguredError(
        this.providerName,
        `missing ${missing.join(',')}`,
      );
    }
  }

  private missingKeys(): string[] {
    return REQUIRED_KEYS.filter((key) => !this.env[key]?.trim());
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function toMoyasarSourceType(channel: PaymentChannel): 'creditcard' | 'applepay' {
  const value = channel as string;
  return value === 'applepay' || value === 'apple_iap' ? 'applepay' : 'creditcard';
}

function toMinorUnits(amount: number, currency: CurrencyCode): number {
  return Math.round(amount * 10 ** currencyDecimals(currency));
}

function fromMinorUnits(amount: number, currency: CurrencyCode): number {
  return amount / 10 ** currencyDecimals(currency);
}

function currencyDecimals(currency: CurrencyCode): number {
  if (currency === 'KWD' || currency === 'BHD') return 3;
  return 2;
}

function normalizeStatus(status: unknown): string {
  return typeof status === 'string' && status.trim() ? status.toLowerCase() : 'unknown';
}

function requireMoyasarId(payment: MoyasarPaymentResponse): string {
  if (!payment.id) {
    throw new Error('MOYASAR_PAYMENT_RESPONSE_MISSING_ID');
  }
  return payment.id;
}

function extractCheckoutUrl(payment: MoyasarPaymentResponse): string | undefined {
  return (
    payment.source?.transaction_url ??
    payment.source?.redirect_url ??
    payment.source?.url ??
    payment.checkout_url ??
    payment.payment_url ??
    payment.redirect_url ??
    payment.transaction_url ??
    payment.invoice_url ??
    payment.url
  );
}

function buildInvoiceStyleUrl(
  payment: MoyasarPaymentResponse,
  providerReference: string,
): string | undefined {
  const invoiceId = payment.invoice_id;
  if (invoiceId) {
    return `${DEFAULT_CHECKOUT_BASE_URL}/invoices/${encodeURIComponent(invoiceId)}`;
  }
  return `${DEFAULT_CHECKOUT_BASE_URL}/payments/${encodeURIComponent(providerReference)}`;
}

function rawBodyToString(rawBody: Buffer | string): string {
  return typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const direct = headers[name] ?? headers[toHeaderCase(name)];
  const value =
    direct ??
    Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

function toHeaderCase(name: string): string {
  return name
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('-');
}

function readMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key] ?? metadata?.[key.toLowerCase()];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

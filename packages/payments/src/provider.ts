import type { CurrencyCode, PaymentChannel, PaymentMode } from '@e3lani/types';

export type ProviderHealth = {
  healthy: boolean;
  message?: string;
  checkedAt: string;
};

export type CreateCheckoutInput = {
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  countryCode: string;
  channel: PaymentChannel;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
};

export type CreateCheckoutResult = {
  provider: string;
  checkoutUrl?: string;
  providerReference: string;
  expiresAt?: string;
};

export type VerifyPaymentInput = {
  providerReference: string;
  orderId: string;
};

export type VerifyPaymentResult = {
  paid: boolean;
  status: string;
  amount?: number;
  currency?: CurrencyCode;
  rawStatus?: string;
};

export type RefundPaymentInput = {
  providerReference: string;
  amount?: number;
  reason?: string;
  idempotencyKey: string;
};

export type RefundPaymentResult = {
  refundId: string;
  status: string;
};

export type ParseWebhookInput = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer | string;
};

export type ParsedWebhookEvent = {
  eventId: string;
  type: string;
  providerReference: string;
  orderId?: string;
  paid: boolean;
  occurredAt: string;
};

export type VerifyWebhookSignatureInput = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer | string;
};

export type GetPaymentStatusInput = {
  providerReference: string;
};

export type PaymentStatusResult = {
  status: string;
  paid: boolean;
};

export interface PaymentProvider {
  readonly providerName: string;
  readonly supportedCountries: readonly string[];
  readonly supportedCurrencies: readonly CurrencyCode[];
  readonly supportedChannels: readonly PaymentChannel[];
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  parseWebhook(input: ParseWebhookInput): Promise<ParsedWebhookEvent>;
  verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean>;
  getPaymentStatus(input: GetPaymentStatusInput): Promise<PaymentStatusResult>;
  healthCheck(): Promise<ProviderHealth>;
}

export type ProviderConfig = {
  name: string;
  enabled: boolean;
  mode: PaymentMode;
  priority: number;
  countries: readonly string[];
  currencies: readonly CurrencyCode[];
  channels: readonly PaymentChannel[];
};

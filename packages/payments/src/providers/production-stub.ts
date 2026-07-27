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
import type { CurrencyCode, PaymentChannel } from '@e3lani/types';

export type ProductionPaymentProviderStubOptions = {
  providerName?: string;
  mode?: string;
  env?: NodeJS.ProcessEnv;
};

export class ProductionPaymentProviderNotConfiguredError extends Error {
  constructor(providerName: string, detail = 'missing production implementation or credentials') {
    super(`PAYMENT_PROVIDER_NOT_CONFIGURED:${providerName}:${detail}`);
    this.name = 'ProductionPaymentProviderNotConfiguredError';
  }
}

const PROVIDER_KEY_REQUIREMENTS: Record<string, readonly string[]> = {
  moyasar: ['MOYASAR_SECRET_KEY', 'MOYASAR_PUBLISHABLE_KEY', 'MOYASAR_WEBHOOK_SECRET'],
  myfatoorah: ['MYFATOORAH_API_KEY'],
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  apple_iap: ['APPLE_IAP_SHARED_SECRET'],
  google_play: ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'],
};

export class ProductionPaymentProviderStub implements PaymentProvider {
  readonly providerName: string;
  readonly supportedCountries = ['*'] as const;
  readonly supportedCurrencies = [
    'SAR',
    'AED',
    'KWD',
    'BHD',
    'QAR',
    'OMR',
    'USD',
    'EUR',
    'GBP',
    'EGP',
    'JOD',
    'MAD',
  ] as readonly CurrencyCode[];
  readonly supportedChannels = [
    'hosted_checkout',
    'apple_iap',
    'google_play',
  ] as readonly PaymentChannel[];

  private readonly mode: string;
  private readonly env: NodeJS.ProcessEnv;

  constructor(options: ProductionPaymentProviderStubOptions = {}) {
    this.env = options.env ?? process.env;
    this.providerName =
      options.providerName ?? this.env.PAYMENT_PROVIDER ?? this.env.PRODUCTION_PAYMENT_PROVIDER ?? 'production';
    this.mode = options.mode ?? this.env.PAYMENT_MODE ?? 'production';
  }

  async createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    this.throwNotConfigured();
  }

  async verifyPayment(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    this.throwNotConfigured();
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.throwNotConfigured();
  }

  async parseWebhook(_input: ParseWebhookInput): Promise<ParsedWebhookEvent> {
    this.throwNotConfigured();
  }

  async verifyWebhookSignature(_input: VerifyWebhookSignatureInput): Promise<boolean> {
    return false;
  }

  async getPaymentStatus(_input: GetPaymentStatusInput): Promise<PaymentStatusResult> {
    return { status: 'not_configured', paid: false };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const missing = this.missingKeys();
    return {
      healthy: false,
      message:
        missing.length > 0
          ? `production payment provider missing keys: ${missing.join(', ')}`
          : 'production payment provider placeholder has no live implementation',
      checkedAt: new Date().toISOString(),
    };
  }

  private missingKeys(): string[] {
    const required = PROVIDER_KEY_REQUIREMENTS[this.providerName] ?? [];
    return required.filter((key) => !this.env[key]?.trim());
  }

  private throwNotConfigured(): never {
    const missing = this.missingKeys();
    const detail =
      this.mode === 'production' || this.mode === 'live'
        ? missing.length > 0
          ? `missing ${missing.join(',')}`
          : 'placeholder has no live implementation'
        : 'production placeholder selected outside sandbox';
    throw new ProductionPaymentProviderNotConfiguredError(this.providerName, detail);
  }
}

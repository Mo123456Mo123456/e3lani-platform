import type { CurrencyCode, PaymentChannel, PlatformChannel } from '@e3lani/types';
import type { ProviderConfig } from './provider';

export type RoutePaymentInput = {
  countryCode: string;
  currency: CurrencyCode;
  platform: PlatformChannel;
  channelHint?: PaymentChannel;
  providers: readonly ProviderConfig[];
};

export type RoutePaymentResult =
  | { ok: true; provider: ProviderConfig; channel: PaymentChannel }
  | { ok: false; reason: string };

function preferredChannel(platform: PlatformChannel, hint?: PaymentChannel): PaymentChannel {
  if (hint) return hint;
  if (platform === 'ios') return 'apple_iap';
  if (platform === 'android') return 'google_play';
  return 'hosted_checkout';
}

export function routePayment(input: RoutePaymentInput): RoutePaymentResult {
  const channel = preferredChannel(input.platform, input.channelHint);
  const candidates = input.providers
    .filter((p) => p.enabled)
    .filter((p) => p.countries.includes(input.countryCode) || p.countries.includes('*'))
    .filter((p) => p.currencies.includes(input.currency))
    .filter((p) => p.channels.includes(channel))
    .sort((a, b) => a.priority - b.priority);

  const provider = candidates[0];
  if (!provider) {
    return {
      ok: false,
      reason: `No payment provider available for ${input.countryCode}/${input.currency}/${channel}`,
    };
  }

  return { ok: true, provider, channel };
}

/** Regional defaults for Gulf web checkout routing (adapters not activated without keys). */
export const DEFAULT_PROVIDER_CATALOG: readonly ProviderConfig[] = [
  {
    name: 'moyasar',
    enabled: false,
    mode: 'sandbox',
    priority: 10,
    countries: ['SA'],
    currencies: ['SAR'],
    channels: ['hosted_checkout'],
  },
  {
    name: 'myfatoorah',
    enabled: false,
    mode: 'sandbox',
    priority: 20,
    countries: ['SA', 'AE', 'KW', 'BH', 'QA', 'OM', 'EG', 'JO'],
    currencies: ['SAR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR', 'EGP', 'JOD'],
    channels: ['hosted_checkout'],
  },
  {
    name: 'stripe',
    enabled: false,
    mode: 'sandbox',
    priority: 50,
    countries: ['*'],
    currencies: ['USD', 'EUR', 'GBP', 'SAR', 'AED'],
    channels: ['hosted_checkout'],
  },
  {
    name: 'apple_iap',
    enabled: false,
    mode: 'sandbox',
    priority: 1,
    countries: ['*'],
    currencies: ['USD', 'SAR', 'AED', 'EUR', 'GBP'],
    channels: ['apple_iap'],
  },
  {
    name: 'google_play',
    enabled: false,
    mode: 'sandbox',
    priority: 1,
    countries: ['*'],
    currencies: ['USD', 'SAR', 'AED', 'EUR', 'GBP'],
    channels: ['google_play'],
  },
];

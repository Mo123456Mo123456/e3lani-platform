import { describe, expect, it } from 'vitest';
import { DEFAULT_PROVIDER_CATALOG, routePayment } from './routing';
import { quoteSaudiSkus } from './pricing-engine';

describe('payment routing', () => {
  it('routes SA web checkout to sandbox when enabled', () => {
    const result = routePayment({
      countryCode: 'SA',
      currency: 'SAR',
      platform: 'web',
      providers: DEFAULT_PROVIDER_CATALOG,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider.name).toBe('sandbox');
      expect(result.channel).toBe('hosted_checkout');
    }
  });

  it('returns clear failure when no provider enabled', () => {
    const result = routePayment({
      countryCode: 'SA',
      currency: 'SAR',
      platform: 'web',
      providers: DEFAULT_PROVIDER_CATALOG.map((p) => ({ ...p, enabled: false })),
    });
    expect(result.ok).toBe(false);
  });

  it('prefers apple_iap on iOS when enabled', () => {
    const providers = DEFAULT_PROVIDER_CATALOG.map((p) =>
      p.name === 'apple_iap' ? { ...p, enabled: true } : p,
    );
    const result = routePayment({
      countryCode: 'SA',
      currency: 'SAR',
      platform: 'ios',
      providers,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider.name).toBe('apple_iap');
      expect(result.channel).toBe('apple_iap');
    }
  });
});

describe('pricing engine', () => {
  it('quotes default SA publish price at 59 SAR', () => {
    const quote = quoteSaudiSkus(['AD_PUBLISH_30D']);
    expect(quote.total).toBe(59);
    expect(quote.currency).toBe('SAR');
  });
});

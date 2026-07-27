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
  it('quotes default SA publish price at 59 SAR tax-inclusive', () => {
    const quote = quoteSaudiSkus(['AD_PUBLISH_30D']);
    expect(quote.total).toBe(59);
    expect(quote.currency).toBe('SAR');
    expect(quote.taxMode).toBe('inclusive');
    expect(quote.taxAmount).toBe(7.7);
    expect(quote.subtotal).toBe(51.3);
    expect(roundMoney(quote.subtotal + quote.taxAmount)).toBe(quote.total);
  });

  it('keeps addon catalog at approved SA amounts', () => {
    const quote = quoteSaudiSkus([
      'AD_REPOST',
      'AD_EXTEND_15D',
      'AD_HIGHLIGHT_3D',
      'AD_HIGHLIGHT_7D',
      'AD_TOP_CATEGORY',
      'AD_EXTRA_CITY',
    ]);
    expect(quote.lines.map((line) => line.unitAmount)).toEqual([10, 29, 15, 29, 29, 10]);
    expect(quote.total).toBe(122);
  });
});

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

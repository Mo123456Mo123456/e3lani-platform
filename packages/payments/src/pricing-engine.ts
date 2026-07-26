import { DEFAULT_SA_PRICING, type CurrencyCode, type PricingSku } from '@e3lani/types';

export type PricedLine = {
  sku: PricingSku;
  labelAr: string;
  labelEn: string;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
  currency: CurrencyCode;
  durationDays?: number;
};

export type PriceQuote = {
  currency: CurrencyCode;
  countryCode: string;
  lines: PricedLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  taxMode: 'inclusive' | 'exclusive' | 'none';
};

export function quoteSaudiSkus(
  skus: readonly PricingSku[],
  options?: { taxMode?: 'inclusive' | 'exclusive' | 'none'; taxRate?: number },
): PriceQuote {
  const taxMode = options?.taxMode ?? 'inclusive';
  const taxRate = options?.taxRate ?? 0.15;
  const lines: PricedLine[] = skus.map((sku) => {
    const item = DEFAULT_SA_PRICING[sku];
    return {
      sku,
      labelAr: item.labelAr,
      labelEn: item.labelEn,
      unitAmount: item.amount,
      quantity: 1,
      lineTotal: item.amount,
      currency: item.currency,
      ...(item.durationDays !== undefined ? { durationDays: item.durationDays } : {}),
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  let taxAmount = 0;
  let total = subtotal;

  if (taxMode === 'exclusive') {
    taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    total = subtotal + taxAmount;
  } else if (taxMode === 'inclusive') {
    taxAmount = Math.round(((subtotal * taxRate) / (1 + taxRate)) * 100) / 100;
    total = subtotal;
  }

  return {
    currency: 'SAR',
    countryCode: 'SA',
    lines,
    subtotal,
    taxAmount,
    total,
    taxMode,
  };
}

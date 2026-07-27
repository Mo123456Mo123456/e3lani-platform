import {
  APPROVED_SA_PUBLISH_TOTAL_SAR,
  DEFAULT_SA_PRICING,
  type CurrencyCode,
  type PricingSku,
} from '@e3lani/types';

export type PricedLine = {
  sku: PricingSku;
  labelAr: string;
  labelEn: string;
  /** Listed unit price (tax-inclusive when taxMode is inclusive). */
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
  /**
   * Net amount before tax (صافي).
   * For tax-inclusive catalogs this is total − taxAmount.
   */
  subtotal: number;
  /** Extracted or added VAT (ضريبة). */
  taxAmount: number;
  /** Amount the customer pays (إجمالي). Equals listed price when tax is inclusive. */
  total: number;
  taxMode: 'inclusive' | 'exclusive' | 'none';
  taxRate: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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

  const listedTotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  let subtotal = listedTotal;
  let taxAmount = 0;
  let total = listedTotal;

  if (taxMode === 'exclusive') {
    // Listed amounts are net; tax is added on top.
    subtotal = listedTotal;
    taxAmount = roundMoney(subtotal * taxRate);
    total = roundMoney(subtotal + taxAmount);
  } else if (taxMode === 'inclusive') {
    // Listed amounts are what the user pays. Split into net + tax; total stays listed.
    total = listedTotal;
    taxAmount = roundMoney((listedTotal * taxRate) / (1 + taxRate));
    subtotal = roundMoney(total - taxAmount);
  } else {
    subtotal = listedTotal;
    taxAmount = 0;
    total = listedTotal;
  }

  return {
    currency: 'SAR',
    countryCode: 'SA',
    lines,
    subtotal,
    taxAmount,
    total,
    taxMode,
    taxRate,
  };
}

export function assertApprovedPublishTotal(total: number): void {
  if (total !== APPROVED_SA_PUBLISH_TOTAL_SAR) {
    throw new Error(
      `Unexpected publish price ${total}. Approved SA publish total is ${APPROVED_SA_PUBLISH_TOTAL_SAR} SAR.`,
    );
  }
}

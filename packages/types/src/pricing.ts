export const PRICING_SKUS = [
  'AD_PUBLISH_30D',
  'AD_REPOST',
  'AD_EXTEND_15D',
  'AD_HIGHLIGHT_3D',
  'AD_HIGHLIGHT_7D',
  'AD_TOP_CATEGORY',
  'AD_EXTRA_CITY',
] as const;

export type PricingSku = (typeof PRICING_SKUS)[number];

export const SUPPORTED_CURRENCIES = [
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
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Default Saudi Arabia catalog — amounts in major units (tax-inclusive list prices).
 * Never hardcode alternate amounts in clients; read from this catalog / API.
 *
 * Approved SA catalog (2026):
 * - Publish 30d: 59
 * - Repost: 10
 * - Extend 15d: 29
 * - Highlight 3d: 15
 * - Highlight 7d: 29
 * - Top of category: 29
 * - Extra city: 10
 */
export const DEFAULT_SA_PRICING: Record<
  PricingSku,
  { amount: number; currency: CurrencyCode; labelAr: string; labelEn: string; durationDays?: number }
> = {
  AD_PUBLISH_30D: {
    amount: 59,
    currency: 'SAR',
    labelAr: 'إعلان عادي 30 يومًا',
    labelEn: 'Standard ad — 30 days',
    durationDays: 30,
  },
  AD_REPOST: {
    amount: 10,
    currency: 'SAR',
    labelAr: 'إعادة نشر',
    labelEn: 'Repost',
  },
  AD_EXTEND_15D: {
    amount: 29,
    currency: 'SAR',
    labelAr: 'تمديد 15 يومًا',
    labelEn: 'Extend 15 days',
    durationDays: 15,
  },
  AD_HIGHLIGHT_3D: {
    amount: 15,
    currency: 'SAR',
    labelAr: 'إبراز 3 أيام',
    labelEn: 'Highlight 3 days',
    durationDays: 3,
  },
  AD_HIGHLIGHT_7D: {
    amount: 29,
    currency: 'SAR',
    labelAr: 'إبراز 7 أيام',
    labelEn: 'Highlight 7 days',
    durationDays: 7,
  },
  AD_TOP_CATEGORY: {
    amount: 29,
    currency: 'SAR',
    labelAr: 'أعلى القسم',
    labelEn: 'Top of category',
  },
  AD_EXTRA_CITY: {
    amount: 10,
    currency: 'SAR',
    labelAr: 'استهداف مدينة',
    labelEn: 'City targeting',
  },
};

/** Customer-facing publish total the user pays (tax-inclusive when VAT applies). */
export const APPROVED_SA_PUBLISH_TOTAL_SAR = DEFAULT_SA_PRICING.AD_PUBLISH_30D.amount;

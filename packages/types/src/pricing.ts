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

/** Default Saudi Arabia catalog — amounts in major units. Never hardcode in clients. */
export const DEFAULT_SA_PRICING: Record<
  PricingSku,
  { amount: number; currency: CurrencyCode; labelAr: string; labelEn: string; durationDays?: number }
> = {
  AD_PUBLISH_30D: {
    amount: 19,
    currency: 'SAR',
    labelAr: 'إعلان عادي 30 يومًا',
    labelEn: 'Standard ad — 30 days',
    durationDays: 30,
  },
  AD_REPOST: {
    amount: 5,
    currency: 'SAR',
    labelAr: 'إعادة نشر',
    labelEn: 'Repost',
  },
  AD_EXTEND_15D: {
    amount: 5,
    currency: 'SAR',
    labelAr: 'تمديد 15 يومًا',
    labelEn: 'Extend 15 days',
    durationDays: 15,
  },
  AD_HIGHLIGHT_3D: {
    amount: 10,
    currency: 'SAR',
    labelAr: 'إبراز 3 أيام',
    labelEn: 'Highlight 3 days',
    durationDays: 3,
  },
  AD_HIGHLIGHT_7D: {
    amount: 20,
    currency: 'SAR',
    labelAr: 'إبراز 7 أيام',
    labelEn: 'Highlight 7 days',
    durationDays: 7,
  },
  AD_TOP_CATEGORY: {
    amount: 15,
    currency: 'SAR',
    labelAr: 'أعلى القسم',
    labelEn: 'Top of category',
  },
  AD_EXTRA_CITY: {
    amount: 5,
    currency: 'SAR',
    labelAr: 'استهداف مدينة إضافية',
    labelEn: 'Extra city targeting',
  },
};

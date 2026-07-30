export const PRICING_SKUS = [
  'AD_PUBLISH_30D',
  'AD_REPOST',
  'AD_EXTEND_15D',
  'AD_HIGHLIGHT_3D',
  'AD_HIGHLIGHT_7D',
  'AD_TOP_CATEGORY',
  'AD_EXTRA_CITY',
  'AD_LOGO_STRIP',
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
 * Never hardcode alternate amounts in clients; read from this catalog / admin API.
 *
 * Approved SA catalog:
 * - Publish 30d: 59
 * - Repost: 5
 * - Extend 15d: 5
 * - Highlight 3d: 10
 * - Highlight 7d: 20
 * - Top of category: 15
 * - Extra city: 5
 * - Logo strip (top ticker): 50
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
    amount: 5,
    currency: 'SAR',
    labelAr: 'إعادة نشر ورفع للأحدث',
    labelEn: 'Repost to latest',
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
    labelAr: 'الظهور أعلى القسم',
    labelEn: 'Top of category',
  },
  AD_EXTRA_CITY: {
    amount: 5,
    currency: 'SAR',
    labelAr: 'استهداف مدينة إضافية',
    labelEn: 'Extra city targeting',
  },
  AD_LOGO_STRIP: {
    amount: 50,
    currency: 'SAR',
    labelAr: 'إضافة شعار للشريط العلوي',
    labelEn: 'Top logo strip placement',
  },
};

/** Customer-facing publish total the user pays when payment mode is enabled. */
export const APPROVED_SA_PUBLISH_TOTAL_SAR = DEFAULT_SA_PRICING.AD_PUBLISH_30D.amount;

/**
 * قائمة الأسعار الافتراضية.
 * لا يوجد أي سعر مكتوب داخل منطق التطبيق: هذه القيم تُبذر مرة واحدة في جدول
 * `PricingItem` ثم تُدار بالكامل من لوحة الإدارة. الخدمات تقرأ السعر من قاعدة
 * البيانات دائمًا وليس من هذا الملف.
 *
 * Default price list — seeded once into the `PricingItem` table and then fully
 * managed from the admin dashboard. Runtime code always reads prices from the DB.
 */
export const PRICING_KEYS = {
  AD_STANDARD: 'AD_STANDARD',
  REPUBLISH: 'REPUBLISH',
  EXTEND_15: 'EXTEND_15',
  HIGHLIGHT_3: 'HIGHLIGHT_3',
  HIGHLIGHT_7: 'HIGHLIGHT_7',
  TOP_OF_CATEGORY: 'TOP_OF_CATEGORY',
  EXTRA_CITY: 'EXTRA_CITY',
  TICKER_LOGO: 'TICKER_LOGO',
} as const;

export type PricingKey = (typeof PRICING_KEYS)[keyof typeof PRICING_KEYS];

export interface SeedPricingItem {
  key: PricingKey;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  /** بالهللات (١ ريال = ١٠٠ هللة) */
  amountHalalas: number;
  durationDays: number | null;
  sortOrder: number;
}

export const DEFAULT_PRICING: SeedPricingItem[] = [
  {
    key: 'AD_STANDARD', nameAr: 'إعلان عادي', nameEn: 'Standard ad',
    descriptionAr: 'نشر إعلان لمدة ٣٠ يومًا', amountHalalas: 5900, durationDays: 30, sortOrder: 1,
  },
  {
    key: 'REPUBLISH', nameAr: 'إعادة نشر ورفع للأحدث', nameEn: 'Republish & bump',
    descriptionAr: 'إعادة الإعلان إلى أعلى قائمة الأحدث', amountHalalas: 500, durationDays: null, sortOrder: 2,
  },
  {
    key: 'EXTEND_15', nameAr: 'تمديد ١٥ يومًا', nameEn: 'Extend 15 days',
    descriptionAr: 'إضافة ١٥ يومًا إلى مدة الإعلان', amountHalalas: 500, durationDays: 15, sortOrder: 3,
  },
  {
    key: 'HIGHLIGHT_3', nameAr: 'إبراز ٣ أيام', nameEn: 'Highlight 3 days',
    descriptionAr: 'إبراز الإعلان لمدة ٣ أيام', amountHalalas: 1000, durationDays: 3, sortOrder: 4,
  },
  {
    key: 'HIGHLIGHT_7', nameAr: 'إبراز ٧ أيام', nameEn: 'Highlight 7 days',
    descriptionAr: 'إبراز الإعلان لمدة ٧ أيام', amountHalalas: 2000, durationDays: 7, sortOrder: 5,
  },
  {
    key: 'TOP_OF_CATEGORY', nameAr: 'الظهور أعلى القسم', nameEn: 'Top of category',
    descriptionAr: 'تثبيت الإعلان أعلى قسمه', amountHalalas: 1500, durationDays: 3, sortOrder: 6,
  },
  {
    key: 'EXTRA_CITY', nameAr: 'استهداف مدينة إضافية', nameEn: 'Extra city targeting',
    descriptionAr: 'إضافة مدينة إلى نطاق عرض الإعلان', amountHalalas: 500, durationDays: null, sortOrder: 7,
  },
  {
    key: 'TICKER_LOGO', nameAr: 'إضافة شعار للشريط العلوي', nameEn: 'Top ticker logo',
    descriptionAr: 'عرض شعارك في الشريط العلوي المتحرك', amountHalalas: 5000, durationDays: 30, sortOrder: 8,
  },
];

export const halalasToSar = (halalas: number): number => Math.round(halalas) / 100;
export const sarToHalalas = (sar: number): number => Math.round(sar * 100);
export const formatSar = (halalas: number, locale: 'ar' | 'en' = 'ar'): string =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(halalasToSar(halalas));

/** ثوابت المجال المشتركة بين كل التطبيقات. */

export const MEDIA_LIMITS = {
  maxImagesPerAd: 5,
  minImagesPerAd: 1,
  maxVideoSeconds: 60,
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
  allowedImageMime: ['image/jpeg', 'image/png', 'image/webp'] as const,
  allowedVideoMime: ['video/mp4', 'video/quicktime'] as const,
  imageVariants: [
    { name: 'thumb', width: 360 },
    { name: 'medium', width: 720 },
    { name: 'large', width: 1280 },
  ],
  videoRenditions: [
    { name: '480p', height: 480, videoBitrate: '900k' },
    { name: '720p', height: 720, videoBitrate: '2000k' },
  ],
} as const;

export const AD_LIMITS = {
  titleMin: 4,
  titleMax: 80,
  descriptionMax: 1000,
  defaultDurationDays: 30,
  /** الحد الأقصى لعدد المدن الإضافية المستهدفة */
  maxExtraCities: 10,
} as const;

export const POST_LIMITS = { captionMax: 600, maxImages: 5, maxVideoSeconds: 60 } as const;

export const TICKER = {
  /** مدة دورة الحركة بالثواني */
  loopDurationSeconds: 40,
  minLogos: 4,
  /** يظهر شعار «إعلاني» كفاصل بعد كل N شعارات */
  separatorEvery: 1,
  clickable: false,
  pauseOnHover: false,
} as const;

export const REPORT_REASONS = [
  { key: 'PROHIBITED_CONTENT', ar: 'محتوى ممنوع أو مخالف', en: 'Prohibited content' },
  { key: 'SCAM', ar: 'محاولة احتيال', en: 'Scam or fraud' },
  { key: 'WRONG_CATEGORY', ar: 'قسم غير مناسب', en: 'Wrong category' },
  { key: 'DUPLICATE', ar: 'إعلان مكرر', en: 'Duplicate ad' },
  { key: 'MISLEADING', ar: 'معلومات مضللة', en: 'Misleading information' },
  { key: 'COPYRIGHT', ar: 'انتهاك حقوق', en: 'Copyright violation' },
  { key: 'BROKEN_CONTACT', ar: 'وسيلة تواصل لا تعمل', en: 'Broken contact method' },
  { key: 'OFFENSIVE', ar: 'محتوى مسيء', en: 'Offensive content' },
  { key: 'OTHER', ar: 'سبب آخر', en: 'Other' },
] as const;

export type ReportReasonKey = (typeof REPORT_REASONS)[number]['key'];

/** كلمات تُرفض آليًا أثناء الرفع (فحص آلي فقط، بلا مراجعة بشرية). */
export const BLOCKED_KEYWORDS: string[] = [
  'خمر', 'مخدرات', 'حشيش', 'شبو', 'كبتاجون', 'مسدس', 'رشاش', 'ذخيرة',
  'تزوير', 'هكر اختراق', 'قروض ربوية', 'غسيل أموال', 'دعارة',
  'cocaine', 'heroin', 'weed for sale', 'fake passport', 'stolen card',
];

/** نطاقات موثوقة للروابط الخارجية — أي رابط خارجها يُرفض آليًا. */
export const ALLOWED_LINK_HOSTS: string[] = [
  'wa.me', 'api.whatsapp.com',
  'instagram.com', 'www.instagram.com',
  'snapchat.com', 'www.snapchat.com',
  'x.com', 'twitter.com',
  'tiktok.com', 'www.tiktok.com',
  'salla.sa', 'zid.sa', 'shopify.com', 'myshopify.com',
  'maroof.sa', 'linktr.ee',
  'youtube.com', 'youtu.be',
  'maps.google.com', 'goo.gl', 'maps.app.goo.gl',
];

export const SAUDI_PHONE_REGEX = /^(?:\+9665|9665|05|5)\d{8}$/;

/** يحوّل أي صيغة سعودية إلى الصيغة الدولية 9665XXXXXXXX */
export function normalizeSaudiPhone(input: string): string | null {
  const digits = String(input).replace(/[^\d+]/g, '').replace(/^\+/, '');
  let local: string;
  if (digits.startsWith('966')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;
  if (!/^5\d{8}$/.test(local)) return null;
  return `966${local}`;
}

export const NOTIFICATION_TYPES = [
  'AD_PUBLISHED', 'AD_EXPIRING_SOON', 'AD_EXPIRED', 'AD_EXTENDED', 'AD_REPUBLISHED',
  'AD_PROMOTED', 'AD_SUSPENDED', 'AD_RESTORED', 'AD_REJECTED',
  'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED',
  'REPORT_RECEIVED', 'REPORT_RESOLVED', 'APPEAL_RECEIVED', 'APPEAL_RESOLVED',
  'TICKER_APPROVED', 'TICKER_REJECTED', 'TICKER_EXPIRED', 'TICKER_ACTIVE',
  'ACCOUNT_VERIFIED', 'ACCOUNT_SUSPENDED', 'POST_REMOVED', 'SYSTEM',
] as const;

export const FEED_TABS = ['for-you', 'nearby', 'latest'] as const;
export type FeedTab = (typeof FEED_TABS)[number];

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

/** تعدادات المجال — مطابقة تمامًا لتعدادات Prisma. */
export const ACCOUNT_TYPES = ['INDIVIDUAL', 'STORE', 'BRAND', 'COMPANY'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AD_STATUSES = [
  'DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REJECTED', 'REMOVED',
] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

export const MEDIA_TYPES = ['IMAGE', 'VIDEO'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_STATUSES = ['PENDING', 'PROCESSING', 'READY', 'FAILED'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const CONTACT_METHODS = [
  'WHATSAPP', 'PHONE', 'STORE_LINK', 'PRODUCT_LINK', 'EXTERNAL_LINK',
] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const REACH_SCOPES = ['CITY', 'KINGDOM'] as const;
export type ReachScope = (typeof REACH_SCOPES)[number];

export const PROMOTION_TYPES = [
  'REPUBLISH', 'EXTEND_15', 'HIGHLIGHT_3', 'HIGHLIGHT_7', 'TOP_OF_CATEGORY', 'EXTRA_CITY',
] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REPORT_STATUSES = ['OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const APPEAL_STATUSES = ['OPEN', 'ACCEPTED', 'REJECTED'] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export const TICKER_STATUSES = [
  'DRAFT', 'PENDING_PAYMENT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'EXPIRED', 'STOPPED',
] as const;
export type TickerStatus = (typeof TICKER_STATUSES)[number];

export const AD_EVENT_TYPES = [
  'IMPRESSION', 'VIEW_START', 'VIEW_COMPLETE', 'CLICK_WHATSAPP', 'CLICK_CALL',
  'CLICK_STORE', 'CLICK_LINK', 'SAVE', 'UNSAVE', 'SHARE', 'REPORT',
] as const;
export type AdEventType = (typeof AD_EVENT_TYPES)[number];

export const IMPRESSION_SOURCES = ['ORGANIC', 'PROMOTED'] as const;
export type ImpressionSource = (typeof IMPRESSION_SOURCES)[number];

export const SORT_OPTIONS = ['latest', 'most-viewed', 'relevance'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

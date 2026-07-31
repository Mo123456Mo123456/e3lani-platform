/** إعدادات التشغيل المخزّنة في جدول AppSetting والقابلة للتعديل من لوحة الإدارة. */
export const SETTING_KEYS = {
  PUBLISHING_MODE: 'PUBLISHING_MODE',
  PAYMENTS_ENABLED: 'PAYMENTS_ENABLED',
  AUTO_MODERATION_ENABLED: 'AUTO_MODERATION_ENABLED',
  TICKER_ENABLED: 'TICKER_ENABLED',
  MIN_APP_VERSION: 'MIN_APP_VERSION',
  SUPPORT_WHATSAPP: 'SUPPORT_WHATSAPP',
  TERMS_VERSION: 'TERMS_VERSION',
  PRIVACY_VERSION: 'PRIVACY_VERSION',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** FREE = مسودة ← نشط مباشرة. PAID = مسودة ← بانتظار الدفع ← نشط. */
export type PublishingMode = 'FREE' | 'PAID';

export const DEFAULT_SETTINGS: Record<SettingKey, unknown> = {
  PUBLISHING_MODE: 'FREE',
  PAYMENTS_ENABLED: false,
  AUTO_MODERATION_ENABLED: true,
  TICKER_ENABLED: true,
  MIN_APP_VERSION: '1.0.0',
  SUPPORT_WHATSAPP: '966500000000',
  TERMS_VERSION: '1.0',
  PRIVACY_VERSION: '1.0',
};

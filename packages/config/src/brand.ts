/**
 * هوية «إعلاني» البصرية — مصدر واحد للحقيقة تستهلكه كل التطبيقات.
 * E3lani brand tokens — single source of truth shared by web, admin and mobile.
 */
export const BRAND = {
  nameAr: 'إعلاني',
  nameEn: 'E3lani',
  taglineAr: 'منصة الإعلانات المرئية لكل شيء',
  taglineEn: 'The visual advertising platform for everything',
  domain: 'e3lani.sa',
} as const;

export const COLORS = {
  /** اللون الرئيسي */
  primary: '#FFC400',
  primaryDark: '#E0AC00',
  primaryLight: '#FFD84D',
  primarySoft: '#FFF6D9',
  /** الأسود */
  black: '#111111',
  ink: '#111111',
  inkMuted: '#5C5C5C',
  white: '#FFFFFF',
  /** الرمادي الفاتح */
  surface: '#F7F7F7',
  border: '#E6E6E6',
  success: '#12A150',
  warning: '#F5A524',
  danger: '#E5484D',
  info: '#0A7EA4',
  overlay: 'rgba(17,17,17,0.55)',
} as const;

export const RADIUS = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const FONTS = {
  ar: ['Tajawal', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
  en: ['Inter', 'system-ui', 'sans-serif'],
} as const;

export type Locale = 'ar' | 'en';
export const DEFAULT_LOCALE: Locale = 'ar';
export const LOCALES: Locale[] = ['ar', 'en'];
export const LOCALE_DIRECTION: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr' };

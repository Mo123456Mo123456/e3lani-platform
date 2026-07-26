export const BRAND = {
  nameAr: 'إعلاني',
  nameEn: 'E3lani',
  taglineAr: 'منصة الإعلانات المرئية لكل شيء',
  taglineEn: 'The Visual Advertising Platform for Everything',
  colors: {
    primary: '#FFC400',
    primaryDark: '#E6AE00',
    black: '#111111',
    charcoal: '#252525',
    gray: '#777777',
    border: '#EEEEEE',
    surface: '#F7F7F7',
    white: '#FFFFFF',
  },
} as const;

export const MEDIA_LIMITS = {
  maxVideoSeconds: 60,
  maxVideoBytes: 200 * 1024 * 1024,
  maxImages: 5,
  minImages: 1,
  maxFilesPerUpload: 10,
  preferredAspectRatio: '9:16',
  videoMime: ['video/mp4', 'video/quicktime'] as const,
  imageMime: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;

export const AUTH_LIMITS = {
  otpTtlSeconds: 300,
  otpMaxAttempts: 5,
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
} as const;

export const AD_POLICY = {
  reviewBeforePayment: true as const,
  defaultDurationDays: 30,
  repostCooldownHours: 72,
  extendDays: 15,
};

export const DEFAULT_COUNTRY = 'SA';

export function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function isProduction(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

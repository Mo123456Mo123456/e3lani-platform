import { BRAND } from '@e3lani/config';

export const tokens = {
  colors: BRAND.colors,
  radius: {
    sm: 10,
    md: 16,
    lg: 24,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    fontFamilyAr: 'IBM Plex Sans Arabic',
    fontFamilyEn: 'IBM Plex Sans',
  },
} as const;

export type DesignTokens = typeof tokens;

/** Full RTL/LTR helpers for web + native shells. */
export type UiDirection = 'rtl' | 'ltr';

export function directionFromLocale(locale: string): UiDirection {
  return locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr';
}

export function isRtl(localeOrDir: string): boolean {
  return localeOrDir === 'rtl' || localeOrDir.toLowerCase().startsWith('ar');
}

export function logicalStart(dir: UiDirection): 'right' | 'left' {
  return dir === 'rtl' ? 'right' : 'left';
}

export function logicalEnd(dir: UiDirection): 'right' | 'left' {
  return dir === 'rtl' ? 'left' : 'right';
}

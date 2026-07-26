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

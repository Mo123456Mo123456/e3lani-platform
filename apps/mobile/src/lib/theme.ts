import { COLORS, RADIUS, SPACING } from '@e3lani/config';

export const theme = {
  colors: {
    primary: COLORS.primary,
    primaryDark: COLORS.primaryDark,
    ink: COLORS.ink,
    inkMuted: COLORS.inkMuted,
    white: COLORS.white,
    surface: COLORS.surface,
    border: COLORS.border,
    danger: COLORS.danger,
    success: COLORS.success,
    warning: COLORS.warning,
    overlay: COLORS.overlay,
  },
  radius: RADIUS,
  spacing: SPACING,
  text: {
    title: { fontSize: 20, fontWeight: '800' as const, color: COLORS.ink },
    subtitle: { fontSize: 16, fontWeight: '700' as const, color: COLORS.ink },
    body: { fontSize: 15, color: COLORS.ink },
    caption: { fontSize: 12, color: COLORS.inkMuted },
  },
};

export type Theme = typeof theme;

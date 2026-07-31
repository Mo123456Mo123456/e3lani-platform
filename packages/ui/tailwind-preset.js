/**
 * إعداد Tailwind المشترك لهوية «إعلاني».
 * يُستخدم في apps/web و apps/admin لضمان هوية بصرية واحدة مع دعم RTL كامل.
 */
const { COLORS, RADIUS, FONTS } = require('@e3lani/config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: COLORS.primary,
          dark: COLORS.primaryDark,
          light: COLORS.primaryLight,
          soft: COLORS.primarySoft,
        },
        ink: { DEFAULT: COLORS.ink, muted: COLORS.inkMuted },
        surface: COLORS.surface,
        line: COLORS.border,
        success: COLORS.success,
        warning: COLORS.warning,
        danger: COLORS.danger,
        info: COLORS.info,
      },
      borderRadius: {
        sm: `${RADIUS.sm}px`,
        md: `${RADIUS.md}px`,
        lg: `${RADIUS.lg}px`,
        xl: `${RADIUS.xl}px`,
        pill: '999px',
      },
      fontFamily: {
        sans: FONTS.ar.slice(),
        latin: FONTS.en.slice(),
      },
      boxShadow: {
        card: '0 2px 12px rgba(17,17,17,0.06)',
        float: '0 8px 28px rgba(17,17,17,0.12)',
      },
      keyframes: {
        'ticker-rtl': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(50%)' },
        },
        'ticker-ltr': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'ticker-rtl': 'ticker-rtl var(--ticker-duration, 40s) linear infinite',
        'ticker-ltr': 'ticker-ltr var(--ticker-duration, 40s) linear infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};

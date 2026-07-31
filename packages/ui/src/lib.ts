import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type Locale = 'ar' | 'en';

export const dir = (locale: Locale): 'rtl' | 'ltr' => (locale === 'ar' ? 'rtl' : 'ltr');

export function formatNumber(value: number, locale: Locale = 'ar'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US').format(value);
}

export function formatPrice(value: number | null, locale: Locale = 'ar'): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function timeAgo(iso: string, locale: Locale = 'ar'): string {
  const diff = Date.now() - new Date(iso).getTime();
  const formatter = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return formatter.format(-Math.round(diff / ms), unit);
  }
  return formatter.format(0, 'minute');
}

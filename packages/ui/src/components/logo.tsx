import * as React from 'react';
import { cn } from '../lib';

export interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  locale?: 'ar' | 'en';
  /** نسخة أحادية اللون تُستخدم كفاصل داخل الشريط العلوي */
  muted?: boolean;
}

/** شعار «إعلاني» — علامة صفراء بسيطة مع كلمة الاسم. */
export function Logo({
  size = 32,
  withWordmark = true,
  className,
  locale = 'ar',
  muted = false,
}: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        role="img"
        aria-label={locale === 'ar' ? 'إعلاني' : 'E3lani'}
        className="shrink-0"
      >
        <rect
          width="48"
          height="48"
          rx="14"
          fill={muted ? '#E6E6E6' : '#FFC400'}
        />
        <path
          d="M14 19.5c0-1.4 1.1-2.5 2.5-2.5h9.8c.9 0 1.7.5 2.2 1.2l4.4 7c.5.8.5 1.8 0 2.6l-4.4 7c-.5.7-1.3 1.2-2.2 1.2h-9.8c-1.4 0-2.5-1.1-2.5-2.5v-14z"
          fill={muted ? '#9A9A9A' : '#111111'}
          opacity={0.92}
        />
        <circle cx="20.5" cy="26.5" r="2.6" fill={muted ? '#E6E6E6' : '#FFC400'} />
      </svg>
      {withWordmark ? (
        <span
          className={cn(
            'font-bold tracking-tight',
            muted ? 'text-ink-muted' : 'text-ink',
          )}
          style={{ fontSize: size * 0.62 }}
        >
          {locale === 'ar' ? 'إعلاني' : 'E3lani'}
        </span>
      ) : null}
    </span>
  );
}

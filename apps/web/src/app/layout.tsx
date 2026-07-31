import type { Metadata, Viewport } from 'next';
import { BRAND, COLORS } from '@e3lani/config';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${BRAND.nameAr} | ${BRAND.nameEn} — ${BRAND.taglineAr}`,
    template: `%s | ${BRAND.nameAr}`,
  },
  description: BRAND.taglineAr,
  applicationName: BRAND.nameEn,
  openGraph: {
    title: `${BRAND.nameAr} — ${BRAND.taglineAr}`,
    description: BRAND.taglineAr,
    locale: 'ar_SA',
    type: 'website',
  },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: COLORS.primary,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-white text-ink antialiased">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { COLORS } from '@e3lani/config';
import './globals.css';

export const metadata: Metadata = {
  title: 'لوحة إدارة إعلاني',
  description: 'لوحة الإدارة الداخلية لمنصة إعلاني',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { themeColor: COLORS.primary, width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-surface text-ink antialiased">{children}</body>
    </html>
  );
}

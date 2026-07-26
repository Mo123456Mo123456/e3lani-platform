import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import '@e3lani/ui/tokens.css';
import './globals.css';

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'لوحة إدارة إعلاني',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={arabic.className}>{children}</body>
    </html>
  );
}

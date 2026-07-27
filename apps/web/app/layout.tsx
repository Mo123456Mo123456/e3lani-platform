import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { AppChrome } from '../components/AppChrome';
import { LocaleProvider } from '../lib/locale';
import './globals.css';

const siteUrl = new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'https://e3lani.com');

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-e3lani',
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: 'إعلاني | E3lani',
  title: {
    default: 'إعلاني | E3lani',
    template: '%s | إعلاني',
  },
  description: 'منصة الإعلانات المرئية لكل شيء',
  keywords: ['إعلاني', 'E3lani', 'إعلانات مرئية', 'إعلانات السعودية', 'Saudi ads'],
  alternates: {
    canonical: '/',
    languages: {
      ar: '/',
      en: '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    alternateLocale: ['en_US'],
    url: '/',
    siteName: 'إعلاني | E3lani',
    title: 'إعلاني | E3lani',
    description: 'منصة الإعلانات المرئية لكل شيء',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'إعلاني | E3lani',
    description: 'منصة الإعلانات المرئية لكل شيء',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={arabic.variable}>
      <body>
        <LocaleProvider>
          <AppChrome>{children}</AppChrome>
        </LocaleProvider>
      </body>
    </html>
  );
}

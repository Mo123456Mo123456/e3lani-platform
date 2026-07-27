import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { AppChrome } from '../components/AppChrome';
import './globals.css';

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-e3lani',
});

export const metadata: Metadata = {
  title: 'إعلاني | E3lani',
  description: 'منصة الإعلانات المرئية لكل شيء',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={arabic.variable}>
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}

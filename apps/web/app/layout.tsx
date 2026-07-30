import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { TopNav } from "@/components/layout/TopNav";
import { FooterPulse } from "@/components/layout/FooterPulse";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const latin = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "كوكب يولد أمامك | Planet Born Before You",
  description: "عالمك، قرارك، أثر لا ينتهي.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} ${latin.variable}`}>
      <body className="atmosphere min-h-screen font-arabic antialiased">
        <div className="starfield fixed inset-0 z-0" aria-hidden />
        <AppProviders>
          <div className="relative z-10 flex min-h-screen flex-col">
            <TopNav />
            <main className="flex-1">{children}</main>
            <FooterPulse />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}

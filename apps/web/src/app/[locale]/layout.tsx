import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Tajawal } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale, locales } from "@/lib/i18n";
import { Providers } from "../providers";
import "@/styles/globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "كوكب يولد أمامك", template: "%s | كوكب يولد أمامك" },
  description: "عالمك، قرارك، أثر لا ينتهي.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#050A15",
  colorScheme: "dark",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${tajawal.variable} ${plex.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

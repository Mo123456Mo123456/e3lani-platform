import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { dir, isLocale, type Locale } from "@/i18n";
import "../globals.css";

export const metadata: Metadata = {
  title: "كوكب يولد أمامك — A Planet Born Before You",
  description: "عالمك، قرارك، أثر لا ينتهي. Your world, your call, an echo that never ends.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#050b14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function LocaleLayout({ children, params }: { children: ReactNode; params: { locale: string } }) {
  const locale: Locale = isLocale(params.locale) ? params.locale : "ar";
  return (
    <html lang={locale} dir={dir(locale)}>
      <body>{children}</body>
    </html>
  );
}

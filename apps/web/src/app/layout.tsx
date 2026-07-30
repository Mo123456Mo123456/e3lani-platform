import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/i18n/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "كوكب يولد أمامك — A Planet Born Before You",
  description:
    "عالمك، قرارك، أثر لا ينتهي. كوكب حي ثلاثي الأبعاد يتطور بمحاكاة سببية حتمية — أضف عنصرًا واحدًا وشاهد أثره عبر آلاف السنين.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#050a14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

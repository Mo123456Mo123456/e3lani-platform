import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "إعلاني | منصة الإعلانات المرئية لكل شيء",
    template: "%s | إعلاني"
  },
  description: "اكتشف إعلانات مرئية من مختلف أنحاء المملكة وتواصل مباشرة مع المعلن.",
  openGraph: {
    title: "إعلاني | E3lani",
    description: "منصة الإعلانات المرئية لكل شيء",
    locale: "ar_SA",
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#FFC400",
  colorScheme: "light"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

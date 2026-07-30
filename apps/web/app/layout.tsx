import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"),
  title: {
    default: "إعلاني | منصة الإعلانات المرئية لكل شيء",
    template: "%s | إعلاني",
  },
  description: "اكتشف الإعلانات المرئية من الأفراد والمتاجر والبراندات في السعودية.",
  openGraph: {
    type: "website",
    locale: "ar_SA",
    siteName: "إعلاني | E3lani",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

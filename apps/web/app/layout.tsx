import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Providers } from "../components/Providers";
import { ServiceWorkerRegistrar } from "../components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "كوكب يولد أمامك",
  description: "منصة تشاركية لاستكشاف كوكب حي وصناعة مستقبل مشترك بالمحاكاة.",
  applicationName: "كوكب يولد أمامك",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#06110f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

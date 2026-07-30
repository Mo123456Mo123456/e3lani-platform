import type { Metadata, Viewport } from "next";
import { Exo_2, Noto_Sans_Arabic } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import "./globals.css";

const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const latin = Exo_2({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "كوكب يولد أمامك | Planet Born Before You",
  description: "عالمك، قرارك، أثر لا ينتهي. Your world. Your decision. An endless impact.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#00d9ff",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} ${latin.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

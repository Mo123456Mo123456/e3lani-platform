import type { Metadata, Viewport } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-arabic" });
const inter = Inter({ subsets: ["latin"], variable: "--font-latin" });

export const metadata: Metadata = {
  title: "كوكب يولد أمامك",
  description: "عالمك، قرارك، أثر لا ينتهي.",
  applicationName: "Living Planet",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#030b12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${inter.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

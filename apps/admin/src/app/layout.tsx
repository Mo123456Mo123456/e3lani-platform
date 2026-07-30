import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Tajawal } from "next/font/google";
import type { ReactNode } from "react";
import "@/styles/globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
});

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "مركز تحكم الكوكب",
  description: "لوحة الإدارة الداخلية لكوكب يولد أمامك",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}

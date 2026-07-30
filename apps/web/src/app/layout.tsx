import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "كوكب يولد أمامك | Planet Born Before You",
  description: "عالمك، قرارك، أثر لا ينتهي.",
  applicationName: "Planet Born",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

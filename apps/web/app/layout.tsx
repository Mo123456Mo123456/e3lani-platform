import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "كوكب يولد أمامك",
  description: "عالمك، قرارك، أثر لا ينتهي.",
  manifest: "/manifest.webmanifest",
  applicationName: "كوكب يولد أمامك",
};

export const viewport: Viewport = {
  themeColor: "#031019",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

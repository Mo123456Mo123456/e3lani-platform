import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planet Admin",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily: "IBM Plex Sans Arabic, Segoe UI, sans-serif",
          background: "#07111f",
          color: "#e2e8f0",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}

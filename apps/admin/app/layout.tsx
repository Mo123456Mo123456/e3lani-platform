import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@e3lani/ui/styles.css";

export const metadata: Metadata = {
  title: "لوحة إدارة إعلاني",
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "إدارة محاكاة أزورا",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

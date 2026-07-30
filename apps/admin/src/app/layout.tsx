import type { ReactNode } from "react";
import "./globals.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

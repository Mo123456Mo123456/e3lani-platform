import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { E3laniLogo } from "@e3lani/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "إعلاني | E3lani",
    template: "%s | إعلاني",
  },
  description: "منصة الإعلانات المرئية لكل شيء",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
            <Link href="/" aria-label="الرئيسية">
              <E3laniLogo />
            </Link>
            <nav className="flex items-center gap-5 text-sm font-bold" aria-label="التنقل الرئيسي">
              <Link href="/?mode=LATEST">الأحدث</Link>
              <Link href="/categories">الأقسام</Link>
              <Link href="/search">البحث</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-black/10 bg-white p-8 text-center text-sm text-zinc-600">
          <p className="font-bold text-black">إعلاني — منصة الإعلانات المرئية لكل شيء</p>
          <div className="mt-3 flex justify-center gap-5">
            <Link href="/terms">الشروط</Link>
            <Link href="/privacy">سياسة الخصوصية</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}

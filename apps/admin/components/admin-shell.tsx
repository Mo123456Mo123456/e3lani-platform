"use client";

import { Button } from "@e3lani/ui";
import {
  BarChart3,
  CreditCard,
  FileClock,
  Flag,
  LayoutDashboard,
  Megaphone,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  ["/dashboard", "نظرة عامة", LayoutDashboard],
  ["/users", "المستخدمون", Users],
  ["/reports", "البلاغات والاعتراضات", Flag],
  ["/pricing", "الأسعار", Tags],
  ["/ticker", "شعارات الشريط", Megaphone],
  ["/payments", "المدفوعات", CreditCard],
  ["/analytics", "التحليلات", BarChart3],
  ["/settings", "الإعدادات", Settings],
  ["/audit", "سجل الإجراءات", FileClock],
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-e3-gray">
      <aside className="fixed inset-y-0 right-0 z-20 hidden w-64 border-l border-black/10 bg-e3-black p-4 text-white lg:block">
        <Link href="/dashboard" className="mb-7 block rounded-2xl bg-e3-yellow p-4 text-e3-black">
          <strong className="text-2xl">إعلاني</strong>
          <span className="mt-1 block text-xs">لوحة الإدارة</span>
        </Link>
        <nav className="space-y-1">
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold ${
                pathname === href ? "bg-white text-e3-black" : "text-white/75 hover:bg-white/10"
              }`}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:mr-64">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-black/10 bg-white px-4 sm:px-7">
          <span className="font-black">مركز عمليات إعلاني</span>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.assign("/login");
            }}
          >
            تسجيل الخروج
          </Button>
        </header>
        <main className="p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}

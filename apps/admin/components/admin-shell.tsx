"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { E3laniLogo } from "@e3lani/ui";

import { api, clearSession, getAccessToken } from "@/lib/api";

const navigation = [
  ["/", "نظرة عامة"],
  ["/users", "المستخدمون"],
  ["/businesses", "الحسابات التجارية"],
  ["/ads", "الإعلانات"],
  ["/posts", "المنشورات"],
  ["/reports", "البلاغات"],
  ["/appeals", "الاعتراضات"],
  ["/categories", "الأقسام"],
  ["/cities", "المدن"],
  ["/prices", "الأسعار"],
  ["/payments", "المدفوعات"],
  ["/notifications", "الإشعارات"],
  ["/analytics", "التحليلات"],
  ["/banners", "شعارات الشريط"],
  ["/audit", "سجل الإجراءات"],
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    void api<{ staffRole: string }>("/auth/me")
      .then((user) => {
        if (user.staffRole === "USER") throw new Error("UNAUTHORIZED");
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center font-bold">جارٍ التحقق…</div>;
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="bg-black p-5 text-white">
        <div className="rounded-xl bg-brand p-3">
          <E3laniLogo />
        </div>
        <p className="mt-4 text-xs text-white/60">لوحة الإدارة المحمية</p>
        <nav className="mt-6 grid gap-1">
          {navigation.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-xl px-4 py-3 text-sm font-bold ${
                pathname === href ? "bg-brand text-black" : "hover:bg-white/10"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="mt-8 w-full rounded-xl border border-white/20 px-4 py-3 text-sm font-bold"
          onClick={() => {
            clearSession();
            router.replace("/login");
          }}
        >
          تسجيل الخروج
        </button>
      </aside>
      <main className="min-w-0 p-5 md:p-8">{children}</main>
    </div>
  );
}

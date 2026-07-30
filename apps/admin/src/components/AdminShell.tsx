"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { ApiSession } from "@/lib/api";
import { clearSession, readSession } from "@/lib/session";

const nav = [
  { href: "/", label: "Dashboard", labelAr: "لوحة التحكم" },
  { href: "/users", label: "Users", labelAr: "المستخدمون" },
  { href: "/contributions", label: "Contributions", labelAr: "المساهمات" },
  { href: "/simulation", label: "Simulation", labelAr: "المحاكاة" },
  { href: "/audit", label: "Audit", labelAr: "السجل" },
  { href: "/ai-usage", label: "AI usage", labelAr: "استخدام الذكاء" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<ApiSession | null>(null);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const current = readSession();
    setSession(current);
    setHydrated(true);
    if (!current) {
      router.replace("/login");
    }
  }, [router]);

  const direction = locale === "ar" ? "rtl" : "ltr";
  const title = useMemo(() => (locale === "ar" ? "إدارة الكوكب" : "Planet Admin"), [locale]);

  if (!hydrated) {
    return <main className="centered">Checking admin session...</main>;
  }

  if (!session) {
    return <main className="centered">Redirecting to login...</main>;
  }

  return (
    <div className="admin-shell" dir={direction}>
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Private console</p>
          <h1>{title}</h1>
        </div>
        <nav>
          {nav.map((item) => (
            <Link key={item.href} className={pathname === item.href ? "active" : ""} href={item.href}>
              {locale === "ar" ? item.labelAr : item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="ghost" type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
            {locale === "ar" ? "English" : "العربية"}
          </button>
          <button
            className="ghost danger"
            type="button"
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="muted">Signed in as</span>
            <strong>{session.user.email}</strong>
          </div>
          <span className="pill">{session.user.role}</span>
        </header>
        {children}
      </div>
    </div>
  );
}

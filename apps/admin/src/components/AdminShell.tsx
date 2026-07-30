"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_SESSION_KEY, getAdminSession, type AdminSession } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "نظرة عامة", icon: "⌂" },
  { href: "/users", label: "المستخدمون", icon: "◎" },
  { href: "/planets", label: "الكواكب والمحاكاة", icon: "◉" },
  { href: "/contributions", label: "مراجعة المساهمات", icon: "◇" },
  { href: "/ai-costs", label: "تكاليف الذكاء", icon: "✦" },
  { href: "/audit-log", label: "سجل التدقيق", icon: "≡" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);

  useEffect(() => {
    const current = getAdminSession();
    if (!current || !["system_admin", "super_admin"].includes(current.user.role)) {
      router.replace("/login");
      return;
    }
    setSession(current);
  }, [router]);

  if (!session) {
    return <div className="admin-loading"><div className="loader-orbit">◉</div><span>التحقق من صلاحيات النظام…</span></div>;
  }

  const logout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    router.replace("/login");
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <span className="planet-logo">◉</span>
          <div><strong>مركز الكوكب</strong><small>SYSTEM CONTROL</small></div>
        </div>
        <div className="system-health"><i /> جميع الأنظمة تعمل</div>
        <nav>
          {links.map((link) => (
            <Link href={link.href} className={pathname === link.href ? "active" : ""} key={link.href}>
              <span>{link.icon}</span>{link.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <span>{session.user.name?.slice(0, 1) || "م"}</span>
          <div><strong>{session.user.name}</strong><small>{session.user.role}</small></div>
          <button onClick={logout} aria-label="تسجيل الخروج">↪</button>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div><span className="status-pulse" /> LIVE SYSTEM</div>
          <span>PLANET-BORN / ADMIN · {new Date().toLocaleDateString("ar")}</span>
        </header>
        {children}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAdminAuth } from "@/lib/client";

const LINKS = [
  { href: "/", label: "المقاييس" },
  { href: "/users", label: "المستخدمون" },
  { href: "/planets", label: "الكواكب والمحاكاة" },
  { href: "/moderation", label: "الإشراف" },
  { href: "/ai", label: "الذكاء الاصطناعي" },
  { href: "/audit", label: "سجل العمليات" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAdminAuth((s) => s.user);
  const clear = useAdminAuth((s) => s.clear);

  useEffect(() => {
    if (!user && pathname !== "/login") router.replace("/login");
    if (user && !["admin", "super_admin", "sim_manager", "moderator"].includes(user.role)) {
      router.replace("/login");
    }
  }, [user, pathname, router]);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">🛰 إدارة الكوكب</div>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`admin-link ${pathname === link.href ? "admin-link--active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <div className="pb-dim" style={{ fontSize: 12, padding: "0 12px" }}>{user?.displayName}</div>
        <button
          className="admin-link"
          style={{ textAlign: "start", background: "none", border: "none", cursor: "pointer" }}
          onClick={() => {
            clear();
            router.replace("/login");
          }}
        >
          خروج
        </button>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}

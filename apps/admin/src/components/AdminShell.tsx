"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, getAccessToken } from "@/lib/api";

const NAV = [
  { href: "/overview", label: "نظرة عامة" },
  { href: "/users", label: "المستخدمون" },
  { href: "/planets", label: "الكواكب" },
  { href: "/contributions", label: "الإضافات والإشراف" },
  { href: "/simulation", label: "المحاكاة" },
  { href: "/ai-usage", label: "استهلاك الذكاء الاصطناعي" },
  { href: "/audit", label: "سجل العمليات" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return <Guard>{children}</Guard>;
}

function Guard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (pathname === "/login") {
      setOk(true);
      return;
    }
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    void api<{ user: { role: string } }>("/api/auth/me")
      .then(({ user }) => {
        if (["MODERATOR", "SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN"].includes(user.role)) setOk(true);
        else router.replace("/login");
      })
      .catch(() => router.replace("/login"));
  }, [pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (!ok) {
    return <div className="min-h-screen flex items-center justify-center text-dim text-sm">…</div>;
  }
  return (
    <div className="min-h-screen flex">
      <aside className="w-52 border-e border-line bg-panel/70 shrink-0 flex flex-col">
        <div className="p-4 border-b border-line font-bold text-sm">لوحة الإدارة</div>
        <nav className="flex-1 p-2 space-y-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded ${pathname.startsWith(item.href) ? "bg-tech/10 text-tech" : "text-dim hover:text-white"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => {
            void api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
            window.localStorage.removeItem("kawkab_admin_at");
            router.replace("/login");
          }}
          className="m-2 text-xs text-dim hover:text-white border border-line rounded px-3 py-2"
        >
          خروج
        </button>
      </aside>
      <main className="flex-1 min-w-0 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}

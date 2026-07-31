"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

const LINKS = [
  { href: "/", label: "نظرة عامة" },
  { href: "/users", label: "المستخدمون" },
  { href: "/planets", label: "الكواكب والمحاكاة" },
  { href: "/review", label: "مراجعة الإضافات" },
  { href: "/ai", label: "استهلاك الذكاء الاصطناعي" },
  { href: "/audit", label: "سجل العمليات" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <strong style={{ color: "var(--planet-accent)", padding: "0 12px 12px", fontSize: 14 }}>
          🪐 إدارة الكوكب
        </strong>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

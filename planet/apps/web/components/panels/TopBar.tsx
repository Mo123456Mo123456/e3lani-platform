"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuthStore, useUiStore } from "@/lib/store";
import { api, setAccessToken } from "@/lib/api";

const NAV_KEYS = ["home", "explore", "civilizations", "species", "resources", "tech", "timeline", "profile"] as const;
const NAV_HREFS: Record<(typeof NAV_KEYS)[number], string> = {
  home: "/", explore: "/explore", civilizations: "/civilizations", species: "/species",
  resources: "/resources", tech: "/tech", timeline: "/timeline", profile: "/profile",
};

export function TopBar() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const notifications = useUiStore((s) => s.notifications);

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <header
      style={{
        display: "flex", alignItems: "center", gap: 16, padding: "0 16px", height: 52,
        borderBottom: "1px solid var(--planet-border)", background: "rgba(5,10,20,0.9)",
        backdropFilter: "blur(10px)", zIndex: 50, flexShrink: 0,
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--planet-text)" }}>
        <span style={{ fontSize: 20 }}>🪐</span>
        <strong style={{ fontSize: 14, color: "var(--planet-accent)" }}>{t.appName}</strong>
      </Link>

      <nav style={{ display: "flex", gap: 2, flex: 1, overflowX: "auto" }}>
        {NAV_KEYS.map((key) => (
          <Link
            key={key}
            href={NAV_HREFS[key]}
            style={{
              padding: "5px 10px", borderRadius: 7, fontSize: 12, whiteSpace: "nowrap",
              color: pathname === NAV_HREFS[key] ? "var(--planet-accent)" : "var(--planet-text-dim)",
              background: pathname === NAV_HREFS[key] ? "rgba(56,189,248,0.08)" : "transparent",
            }}
          >
            {t.nav[key]}
          </Link>
        ))}
      </nav>

      <button
        onClick={() => router.push("/notifications")}
        title={t.nav.notifications}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, position: "relative" }}
      >
        🔔
        {notifications.length > 0 && (
          <span
            style={{
              position: "absolute", top: -4, insetInlineEnd: -4, background: "var(--planet-red)",
              borderRadius: 999, fontSize: 9, color: "#fff", padding: "1px 5px",
            }}
          >
            {notifications.length}
          </span>
        )}
      </button>

      <button
        onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        className="chip"
        style={{ border: "1px solid var(--planet-border)" }}
      >
        {t.common.language}
      </button>

      {user ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--planet-text-dim)" }}>{user.displayName ?? user.email}</span>
          <button onClick={logout} className="chip">{t.auth.logout}</button>
        </div>
      ) : (
        <Link href="/login" className="chip" style={{ color: "var(--planet-accent)", borderColor: "var(--planet-accent)" }}>
          {t.auth.login}
        </Link>
      )}
    </header>
  );
}

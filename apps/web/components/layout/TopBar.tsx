"use client";

import { useAppStore } from "@/stores/app";
import { t } from "@/i18n/dict";
import { clearTokens } from "@/lib/api";

const NAV = [
  "home",
  "explore",
  "civilizations",
  "creatures",
  "resources",
  "tech",
  "alliances",
  "timeline",
] as const;

export function TopBar() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const user = useAppStore((s) => s.setUser);
  const currentUser = useAppStore((s) => s.user);
  const notifications = useAppStore((s) => s.notifications);
  const year = useAppStore((s) => s.year);
  const tick = useAppStore((s) => s.tick);
  const d = t(locale);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "0.75rem 1.25rem",
        borderBottom: "1px solid var(--border)",
        background: "rgba(5,10,20,0.75)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 30% 30%, #67e8f9, #0369a1 55%, #0f172a)",
            boxShadow: "var(--glow)",
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, letterSpacing: "0.02em", fontSize: "1.05rem" }}>
            {d.brand}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: "0.75rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {d.tagline}
          </div>
        </div>
      </div>

      <nav
        className="desktop-only"
        style={{
          display: "flex",
          gap: "0.35rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {NAV.map((key) => (
          <a
            key={key}
            href={key === "home" ? "/" : `#${key}`}
            className="chip"
            style={{
              borderColor:
                key === "home" ? "rgba(34,211,238,0.5)" : "var(--border)",
              color: key === "home" ? "var(--cyan)" : "var(--text-dim)",
            }}
          >
            {d[key]}
          </a>
        ))}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span className="chip">
          <span className="live-dot" /> {d.live} · {d.year} {year} · {d.tick} {tick}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          type="button"
        >
          {locale === "ar" ? "EN" : "ع"}
        </button>
        <span className="chip" title={notifications[0]?.titleAr}>
          🔔 {notifications.length}
        </span>
        {currentUser ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ textAlign: locale === "ar" ? "left" : "right" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                {currentUser.displayName}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                Lv.{currentUser.level} · XP {currentUser.xp}
              </div>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() => {
                clearTokens();
                user(null);
              }}
            >
              {d.logout}
            </button>
          </div>
        ) : (
          <a className="btn btn-primary" href="/auth">
            {d.login}
          </a>
        )}
      </div>
    </header>
  );
}

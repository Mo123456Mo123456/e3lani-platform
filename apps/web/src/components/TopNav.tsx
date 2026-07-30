"use client";

import { useSession } from "@/stores/session";
import { messages } from "@/i18n/messages";

const links = [
  "home",
  "explore",
  "civilizations",
  "creatures",
  "resources",
  "technologies",
  "alliances",
  "controlPanel",
] as const;

export function TopNav({
  onAuth,
  onNotify,
}: {
  onAuth: () => void;
  onNotify: () => void;
}) {
  const { user, locale, setLocale, clear } = useSession();
  const t = messages[locale];

  return (
    <header
      className="fade-in"
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: "1rem",
        alignItems: "center",
        padding: "0.75rem 1.25rem",
        borderBottom: "1px solid var(--planet-border)",
        background: "rgba(5,11,22,0.72)",
        backdropFilter: "blur(16px)",
        position: "relative",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          className="pulse-glow"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 30% 30%, #67e8f9, #0369a1 55%, #082f49)",
            border: "1px solid rgba(103,232,249,0.5)",
          }}
        />
        <div>
          <div
            style={{
              fontFamily: "Orbitron, var(--font-display)",
              fontWeight: 700,
              fontSize: "1.05rem",
              letterSpacing: "0.02em",
            }}
          >
            {t.brand}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--planet-muted)" }}>{t.tagline}</div>
        </div>
      </div>

      <nav
        style={{
          display: "flex",
          gap: "0.85rem",
          justifyContent: "center",
          flexWrap: "wrap",
          fontSize: "0.86rem",
          color: "var(--planet-muted)",
        }}
      >
        {links.map((key, idx) => (
          <span
            key={key}
            style={{
              color: idx === 0 ? "var(--planet-cyan)" : undefined,
              fontWeight: idx === 0 ? 600 : 400,
              cursor: "default",
            }}
          >
            {t[key]}
          </span>
        ))}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button
          className="planet-btn planet-btn-ghost"
          style={{ padding: "0.4rem 0.7rem" }}
          onClick={() => {
            const next = locale === "ar" ? "en" : "ar";
            setLocale(next);
            document.documentElement.lang = next;
            document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
          }}
        >
          {locale === "ar" ? "EN" : "ع"}
        </button>
        <button
          className="planet-btn planet-btn-ghost"
          style={{ padding: "0.4rem 0.7rem" }}
          onClick={onNotify}
          title="notifications"
        >
          🔔
        </button>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ textAlign: "start" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user.displayName}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--planet-gold)" }}>
                {t.level} {user.level}
              </div>
              <div
                style={{
                  marginTop: 4,
                  width: 90,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(148,163,184,0.2)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (user.xp % 1000) / 10)}%`,
                    height: "100%",
                    background: "linear-gradient(90deg,#22d3ee,#a78bfa)",
                  }}
                />
              </div>
            </div>
            <button className="planet-btn planet-btn-ghost" onClick={clear}>
              {t.logout}
            </button>
          </div>
        ) : (
          <button className="planet-btn planet-btn-primary" onClick={onAuth}>
            {t.login}
          </button>
        )}
      </div>
    </header>
  );
}

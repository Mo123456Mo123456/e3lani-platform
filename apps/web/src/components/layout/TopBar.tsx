"use client";

import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

const NAV = [
  "home",
  "explore",
  "civilizations",
  "creatures",
  "resources",
  "technologies",
  "alliances",
  "timeline",
  "panel",
] as const;

export function TopBar({
  onLogin,
  onLogout,
}: {
  onLogin: () => void;
  onLogout: () => void;
}) {
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const setLocale = useAppStore((s) => s.setLocale);
  const xpPct = user ? Math.min(100, (user.xp % 1000) / 10) : 0;

  return (
    <header className="topbar">
      <div className="topbar-user">
        {user ? (
          <>
            <div className="avatar">{user.displayName.slice(0, 1)}</div>
            <div>
              <div className="user-name">{user.displayName}</div>
              <div className="user-meta">
                {t(locale, "level")} {user.level}
              </div>
              <div className="xp">
                <span style={{ width: `${xpPct}%` }} />
              </div>
            </div>
            <button className="icon-btn" onClick={onLogout} title={t(locale, "logout")}>
              ⎋
            </button>
          </>
        ) : (
          <button className="pb-btn pb-btn-primary" onClick={onLogin}>
            {t(locale, "login")}
          </button>
        )}
      </div>

      <nav className="topbar-nav">
        {NAV.map((key) => (
          <a key={key} href={`#${key}`} className={key === "home" ? "active" : undefined}>
            {t(locale, key)}
          </a>
        ))}
      </nav>

      <div className="topbar-brand">
        <div className="brand-mark" aria-hidden />
        <div>
          <div className="brand">{t(locale, "brand")}</div>
          <div className="tagline">{t(locale, "tagline")}</div>
        </div>
        <button
          className="lang-btn"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        >
          {locale === "ar" ? "EN" : "ع"}
        </button>
      </div>
    </header>
  );
}

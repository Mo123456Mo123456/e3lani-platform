"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function TopBar() {
  const { t, locale, setLocale } = useI18n();
  const user = useAppStore((s) => s.user);
  const setSession = useAppStore((s) => s.setSession);
  const connected = useAppStore((s) => s.connected);
  const notifications = useAppStore((s) => s.notifications);
  const setCivsModalOpen = useAppStore((s) => s.setCivsModalOpen);
  const setNotifOpen = useAppStore((s) => s.setNotifOpen);
  const notifOpen = useAppStore((s) => s.notifOpen);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="logo" aria-hidden>◉</span>
        <div>
          <div className="brand-name">{t.appName}</div>
          <div className="brand-tagline">{t.tagline}</div>
        </div>
      </div>

      <nav className="topbar-nav">
        <Link href="/">{t.nav.home}</Link>
        <button onClick={() => setCivsModalOpen(true)}>{t.nav.civilizations}</button>
        <a href="#timeline">{t.nav.timeline}</a>
        {user && <Link href="/dashboard">{t.nav.dashboard}</Link>}
      </nav>

      <div className="topbar-actions">
        <span className={`conn-dot ${connected ? "on" : "off"}`} title={connected ? t.common.connected : t.common.disconnected} />
        {user && (
          <button className="icon-btn" onClick={() => setNotifOpen(!notifOpen)} aria-label={t.nav.notifications}>
            🔔{unread > 0 && <span className="badge">{unread}</span>}
          </button>
        )}
        <button className="lang-btn" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
          {t.nav.language}
        </button>
        {user ? (
          <button
            className="account-btn"
            onClick={() => {
              api.logout();
              setSession(null);
            }}
          >
            {user.displayName} · {t.nav.logout}
          </button>
        ) : (
          <Link href="/login" className="account-btn">
            {t.nav.login}
          </Link>
        )}
      </div>
    </header>
  );
}

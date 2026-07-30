"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/stores/locale-store";
import styles from "@/app/app.module.css";

const navItems = [
  { href: "/", key: "home" },
  { href: "/explore", key: "explore" },
  { href: "/civilizations", key: "civilizations" },
  { href: "/explore#creatures", key: "creatures" },
  { href: "/explore#resources", key: "resources" },
  { href: "/explore#technologies", key: "technologies" },
  { href: "/civilizations#alliances", key: "alliances" },
  { href: "/#timeline", key: "timeline" },
  { href: "/me", key: "userPanel" },
] as const;

export function TopBar({ notificationCount = 0 }: { notificationCount?: number }) {
  const { t, toggleLocale } = useI18n();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <header className={styles.topBar}>
      <Link href="/" className={styles.brand} aria-label={t.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          ◌
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandTitle}>{t.brand}</span>
          <span className={styles.brandTagline}>{t.tagline}</span>
        </span>
      </Link>

      <nav className={styles.nav} aria-label="Main">
        {navItems.map((item) => (
          <Link key={item.href + item.key} href={item.href} className={styles.navLink}>
            {t.nav[item.key]}
          </Link>
        ))}
      </nav>

      <div className={styles.topActions}>
        <button className={styles.iconButton} type="button" aria-label={t.dashboard.notifications}>
          ✦
          {notificationCount > 0 ? <span className={styles.notificationBadge}>{Math.min(notificationCount, 99)}</span> : null}
        </button>
        <button className={styles.ghostButton} type="button" onClick={toggleLocale}>
          {t.actions.switchLanguage}
        </button>
        {user ? (
          <>
            <Link className={styles.chip} href="/me">
              <span className={styles.dot} />
              {t.dashboard.explorerLevel} {user.level}
            </Link>
            <button className={styles.ghostButton} type="button" onClick={logout}>
              {t.actions.logout}
            </button>
          </>
        ) : (
          <Link className={styles.chip} href="/login">
            <span className={styles.dot} />
            {t.dashboard.explorerLevel} Level 0
          </Link>
        )}
      </div>
    </header>
  );
}

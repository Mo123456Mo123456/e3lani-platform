"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary, Locale } from "@/lib/i18n";

const navKeys = [
  "home",
  "explore",
  "civilizations",
  "creatures",
  "resources",
  "technologies",
  "alliances",
  "timeline",
  "dashboard",
] as const;

const routes: Record<(typeof navKeys)[number], string> = {
  home: "",
  explore: "/explore",
  civilizations: "/explore?layer=civilizations",
  creatures: "/explore?layer=creatures",
  resources: "/explore?layer=resources",
  technologies: "/explore?layer=technologies",
  alliances: "/explore?layer=alliances",
  timeline: "/timeline",
  dashboard: "/profile",
};

export function TopNav({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const pathname = usePathname();
  const otherLocale = locale === "ar" ? "en" : "ar";
  const translatedPath = pathname.replace(/^\/(ar|en)/, `/${otherLocale}`);

  return (
    <header className="top-nav">
      <Link className="brand" href={`/${locale}`}>
        <span className="brand-mark" aria-hidden="true">
          <span />
        </span>
        <span className="brand-copy">
          <strong>{dictionary.brand}</strong>
          <small>{dictionary.tagline}</small>
        </span>
      </Link>

      <nav className="nav-links" aria-label="Main navigation">
        {navKeys.map((key) => (
          <Link
            key={key}
            className={pathname === `/${locale}${routes[key]}` ? "active" : ""}
            href={`/${locale}${routes[key]}`}
          >
            {dictionary.nav[key]}
          </Link>
        ))}
      </nav>

      <div className="nav-actions">
        <button className="icon-button notification-button" aria-label={dictionary.notifications}>
          <span aria-hidden="true">◌</span>
          <i />
        </button>
        <Link className="language-toggle" href={translatedPath}>
          {dictionary.language}
        </Link>
        <Link className="avatar" href={`/${locale}/profile`} aria-label={dictionary.profile}>
          م
        </Link>
      </div>
    </header>
  );
}

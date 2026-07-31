"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { closeSocket } from "@/lib/ws";

const NAV_ITEMS = [
  "home", "explore", "civilizations", "creatures", "resources",
  "technologies", "alliances", "timeline", "dashboard",
] as const;

export function TopBar() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api().getNotifications(),
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });
  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  const otherLocale = locale === "ar" ? "en" : "ar";
  const switchLocale = () => {
    document.cookie = `pb_locale=${otherLocale};path=/;max-age=31536000`;
    router.push(pathname.replace(`/${locale}`, `/${otherLocale}`));
  };

  const logout = async () => {
    try {
      await api().logout();
    } finally {
      clear();
      closeSocket();
      router.push(`/${locale}/login`);
    }
  };

  return (
    <header className="topbar app-topbar">
      <Link href={`/${locale}`} className="topbar-logo">
        <img src="/icon.svg" alt="" />
        <span>{dict.appName}</span>
      </Link>
      <nav className="topbar-nav">
        {NAV_ITEMS.map((item) => {
          const href = item === "home" ? `/${locale}` : `/${locale}/${item}`;
          const active = item === "home" ? pathname === `/${locale}` : pathname.startsWith(href);
          return (
            <Link key={item} href={href} className={`topbar-link ${active ? "topbar-link--active" : ""}`}>
              {dict.nav[item]}
            </Link>
          );
        })}
      </nav>
      {user ? (
        <>
          <Badge tone={unread > 0 ? "warning" : undefined}>
            {dict.common.notifications} {unread > 0 ? `(${unread})` : ""}
          </Badge>
          <span className="pb-dim" style={{ fontSize: 13 }}>{user.displayName}</span>
          <button className="topbar-link" onClick={switchLocale}>{otherLocale.toUpperCase()}</button>
          <button className="topbar-link" onClick={logout}>{dict.nav.logout}</button>
        </>
      ) : (
        <>
          <button className="topbar-link" onClick={switchLocale}>{otherLocale.toUpperCase()}</button>
          <Link href={`/${locale}/login`} className="topbar-link">{dict.nav.login}</Link>
          <Link href={`/${locale}/register`} className="topbar-link topbar-link--active">{dict.nav.register}</Link>
        </>
      )}
    </header>
  );
}

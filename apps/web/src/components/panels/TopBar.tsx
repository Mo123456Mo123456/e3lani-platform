"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@kawkab/ui";
import { authApi, api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { useT } from "../LocaleProvider";
import type { MessageKey } from "@/i18n";

const NAV: Array<{ href: string; key: MessageKey }> = [
  { href: "", key: "nav.home" },
  { href: "/explore", key: "nav.explore" },
  { href: "/civilizations", key: "nav.civilizations" },
  { href: "/creatures", key: "nav.creatures" },
  { href: "/resources", key: "nav.resources" },
  { href: "/technologies", key: "nav.technologies" },
  { href: "/alliances", key: "nav.alliances" },
  { href: "/timeline", key: "nav.timeline" },
];

export function TopBar() {
  const { locale, t } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const user = useWorldStore((s) => s.user);
  const setUser = useWorldStore((s) => s.setUser);
  const connected = useWorldStore((s) => s.connected);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void authApi.restore().then((u) => setUser(u)).catch(() => setUser(null));
  }, [setUser]);

  const { data: provider } = useQuery({
    queryKey: ["ai-provider"],
    queryFn: () => api<{ name: string; sandbox: boolean }>("/api/ai/provider"),
    staleTime: 300_000,
  });

  const { data: notifs } = useQuery({
    queryKey: ["notif-count"],
    queryFn: () => api<{ unreadCount: number }>("/api/notifications"),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const switchLocale = () => {
    const next = locale === "ar" ? "en" : "ar";
    document.cookie = `kawkab_locale=${next};path=/;max-age=31536000`;
    const rest = pathname.replace(/^\/(ar|en)/, "");
    router.push(`/${next}${rest}`);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="flex items-center gap-3 px-3 h-12">
        <Link href={`/${locale}`} className="flex items-center gap-2 shrink-0">
          <span className="inline-block w-6 h-6 rounded-full bg-gradient-to-br from-tech to-nature shadow-[0_0_12px_#38bdf866]" />
          <span className="font-bold text-sm hidden sm:block">{t("app.name")}</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-1 text-[13px] overflow-x-auto">
          {NAV.map((item) => {
            const href = `/${locale}${item.href}`;
            const active = pathname === href;
            return (
              <Link key={item.key} href={href} className={`px-2 py-1 rounded whitespace-nowrap ${active ? "text-tech bg-tech/10" : "text-dim hover:text-white"}`}>
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <button className="lg:hidden text-dim" onClick={() => setMenuOpen((v) => !v)} aria-label="menu">
          ☰
        </button>
        <div className="flex-1" />
        {provider?.sandbox && (
          <span title={t("sandbox.explained")} className="hidden md:block">
            <Badge color="#facc15">{t("sandbox.badge")}</Badge>
          </span>
        )}
        <span title={connected ? t("common.connectWs.live") : t("common.connectWs.off")} className={`w-2 h-2 rounded-full ${connected ? "bg-nature shadow-[0_0_8px_#34d399]" : "bg-war"}`} />
        {user ? (
          <>
            <Link href={`/${locale}/notifications`} className="relative text-dim hover:text-white px-1">
              🔔
              {(notifs?.unreadCount ?? 0) > 0 && (
                <span className="absolute -top-1 -end-1 bg-war text-white text-[10px] rounded-full px-1">{notifs!.unreadCount}</span>
              )}
            </Link>
            <Link href={`/${locale}/dashboard`} className="text-sm text-tech hover:underline whitespace-nowrap">
              {user.displayName}
            </Link>
            <button
              className="text-dim text-xs hover:text-white"
              onClick={() => {
                void authApi.logout().then(() => setUser(null));
              }}
            >
              {t("nav.logout")}
            </button>
          </>
        ) : (
          <Link href={`/${locale}/auth/login`} className="text-sm text-tech hover:underline">
            {t("nav.login")}
          </Link>
        )}
        <Link href={`/${locale}/settings`} className="text-dim hover:text-white" title={t("nav.settings")}>
          ⚙
        </Link>
        <button onClick={switchLocale} className="text-xs border border-line rounded px-2 py-1 text-dim hover:text-white">
          {locale === "ar" ? "EN" : "ع"}
        </button>
      </div>
      {menuOpen && (
        <nav className="lg:hidden border-t border-line bg-panel px-3 py-2 flex flex-col gap-1 text-sm">
          {NAV.map((item) => (
            <Link key={item.key} href={`/${locale}${item.href}`} onClick={() => setMenuOpen(false)} className="text-dim hover:text-white py-1">
              {t(item.key)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

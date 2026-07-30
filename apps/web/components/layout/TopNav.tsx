"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import { usePlanetStore } from "@/lib/planet-store";
import { useAuthStore } from "@/lib/auth-store";
import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const links = [
  { href: "/", key: "home" as const },
  { href: "/explore", key: "explore" as const },
  { href: "/civilizations", key: "civilizations" as const },
  { href: "/creatures", key: "creatures" as const },
  { href: "/timeline", key: "timeline" as const },
  { href: "/contribute", key: "contribute" as const },
];

export function TopNav() {
  const pathname = usePathname();
  const locale = usePlanetStore((s) => s.locale);
  const setLocale = usePlanetStore((s) => s.setLocale);
  const dict = t(locale);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  return (
    <header className="relative z-30 flex items-center gap-3 border-b border-cyan/20 bg-slate-950/60 px-3 py-2 backdrop-blur-md sm:px-5">
      <Link href="/" className="group flex min-w-0 items-center gap-2.5">
        <motion.span
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan/50 bg-cyan/10 shadow-glow"
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          aria-hidden
        >
          <span className="h-5 w-5 rounded-full bg-gradient-to-br from-cyan via-green to-gold opacity-90" />
        </motion.span>
        <span className="min-w-0">
          <span className="block truncate text-base font-bold tracking-tight text-gradient-cyan sm:text-lg">
            {dict.brand}
          </span>
          <span className="hidden truncate text-[11px] text-muted sm:block">{dict.slogan}</span>
        </span>
      </Link>

      <nav className="mx-auto hidden max-w-2xl flex-1 items-center justify-center gap-1 lg:flex">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              "rounded-md px-2.5 py-1.5 text-xs transition",
              pathname === l.href
                ? "bg-cyan/15 text-cyan"
                : "text-muted hover:bg-white/5 hover:text-ink",
            )}
          >
            {dict.nav[l.key]}
          </Link>
        ))}
      </nav>

      <div className="ms-auto flex items-center gap-2">
        {user ? (
          <>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-green/40 bg-green/10 text-xs font-bold text-green">
                {user.displayName?.slice(0, 1) || "؟"}
              </div>
              <div className="min-w-[88px]">
                <div className="text-[11px] text-ink">{user.displayName}</div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan to-green" />
                </div>
              </div>
            </div>
            <Badge tone="muted" title={dict.notifications}>
              3
            </Badge>
            <Link href="/profile">
              <Button variant="ghost" size="sm">
                {dict.nav.profile}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => clear()}>
              {dict.nav.logout}
            </Button>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button variant="secondary" size="sm">
                {dict.nav.login}
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">{dict.nav.register}</Button>
            </Link>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          aria-label={dict.language}
        >
          {locale === "ar" ? "EN" : "ع"}
        </Button>
      </div>
    </header>
  );
}

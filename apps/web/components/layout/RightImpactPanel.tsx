"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";
import { useAuthStore } from "@/lib/auth-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const cats = [
  { key: "species", tone: "green" as const, href: "/contribute" },
  { key: "plant", tone: "cyan" as const, href: "/contribute" },
  { key: "invention", tone: "gold" as const, href: "/contribute" },
  { key: "culture", tone: "purple" as const, href: "/contribute" },
  { key: "event", tone: "orange" as const, href: "/contribute" },
  { key: "element", tone: "muted" as const, href: "/contribute" },
];

export function RightImpactPanel() {
  const locale = usePlanetStore((s) => s.locale);
  const dict = t(locale);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);

  const { data } = useQuery({
    queryKey: ["contributions", user?.id],
    queryFn: () => api.getContributions(),
    enabled: !!token,
  });

  const count = data?.contributions?.length ?? 0;

  return (
    <Panel className="flex h-full max-h-[calc(100vh-11rem)] flex-col" title={dict.impact.title}>
      <Link href="/contribute" className="mb-4 block">
        <Button variant="primary" size="lg" className="w-full shadow-glow">
          {dict.impact.cta}
        </Button>
      </Link>

      <h3 className="mb-2 text-[11px] uppercase tracking-wider text-muted">
        {dict.impact.categories}
      </h3>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {cats.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-center text-xs text-ink transition hover:border-cyan/30"
          >
            <Badge tone={c.tone} className="mb-1">
              {dict.categories[c.key as keyof typeof dict.categories]}
            </Badge>
          </Link>
        ))}
      </div>

      <h3 className="mb-2 text-[11px] uppercase tracking-wider text-muted">{dict.impact.stats}</h3>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-3 text-center">
          <div className="text-xl font-bold text-cyan">{user ? count : "—"}</div>
          <div className="text-[10px] text-muted">{dict.impact.contributions}</div>
        </div>
        <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-center">
          <div className="text-xl font-bold text-gold">{user ? Math.min(99, 10 + count * 3) : "—"}</div>
          <div className="text-[10px] text-muted">{dict.impact.reputation}</div>
        </div>
      </div>

      <Link href="/contribute">
        <Button variant="gold" size="sm" className="w-full">
          {dict.impact.aiCta}
        </Button>
      </Link>
    </Panel>
  );
}

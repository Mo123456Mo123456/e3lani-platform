"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@kawkab/ui";
import type { UserDashboard } from "@kawkab/shared-types";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatCompact } from "@/lib/format";
import { useT } from "../LocaleProvider";
import { LayerSwitcher } from "./LayerSwitcher";

/** right panel: add element + layers + the user's impact at a glance */
export function ContributionPanel() {
  const { t, locale } = useT();
  const user = useWorldStore((s) => s.user);
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<UserDashboard>("/api/users/me/dashboard"),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      <Link href={`/${locale}/contribute`}>
        <Button variant="primary" style={{ width: "100%", padding: "14px", fontSize: 14 }}>
          ✦ {t("home.addElement")}
        </Button>
      </Link>

      <div>
        <div className="text-[11px] text-dim mb-1.5">{t("home.layers")}</div>
        <LayerSwitcher />
      </div>

      {user && dashboard && (
        <div className="rounded-lg border border-line bg-panelAlt p-3">
          <div className="text-[11px] text-dim mb-2">{t("home.yourImpact")}</div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <MiniStat label={t("dashboard.contributions")} value={formatCompact(dashboard.stats.contributions, locale)} />
            <MiniStat label={t("dashboard.effects")} value={formatCompact(dashboard.stats.totalEffects, locale)} />
            <MiniStat label={t("dashboard.affectedCivs")} value={formatCompact(dashboard.stats.affectedCivilizations, locale)} />
            <MiniStat label={t("dashboard.impactLevel")} value={formatCompact(dashboard.stats.impactLevel, locale)} color="#f5c452" />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] text-dim">{label}</div>
      <div className="text-base font-bold tabular-nums" style={{ color: color ?? "#e6edf3" }}>
        {value}
      </div>
    </div>
  );
}

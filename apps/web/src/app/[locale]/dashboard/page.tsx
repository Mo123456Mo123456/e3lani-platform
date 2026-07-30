"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Panel, Spinner } from "@kawkab/ui";
import { categoryColorOf, eventColorOf } from "@kawkab/ui";
import type { UserDashboard } from "@kawkab/shared-types";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatCompact, formatNumber } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";
import type { MessageKey } from "@/i18n";

export default function DashboardPage() {
  const { t, locale } = useT();
  const user = useWorldStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<UserDashboard>("/api/users/me/dashboard"),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto mt-16 px-4">
        <Panel title={t("dashboard.title")}>
          <div className="text-dim text-sm">{t("contribute.loginRequired")}</div>
        </Panel>
      </div>
    );
  }
  if (isLoading || !data) {
    return <div className="p-10 flex justify-center"><Spinner /></div>;
  }

  const stats: Array<{ key: MessageKey; value: string; color?: string }> = [
    { key: "dashboard.contributions", value: formatCompact(data.stats.contributions, locale) },
    { key: "dashboard.effects", value: formatCompact(data.stats.totalEffects, locale) },
    { key: "dashboard.affectedCivs", value: formatCompact(data.stats.affectedCivilizations, locale), color: "#f5c452" },
    { key: "dashboard.impactAge", value: formatNumber(data.stats.longestImpactYears, locale) },
    { key: "dashboard.impactLevel", value: formatCompact(data.stats.impactLevel, locale), color: "#38bdf8" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold">{t("dashboard.title")}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.key} className="rounded-lg border border-line bg-panel p-3 text-center">
            <div className="text-[11px] text-dim">{t(s.key)}</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: s.color ?? "#e6edf3" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title={t("dashboard.contributions")}>
          {data.contributions.length === 0 && <div className="text-dim text-sm">{t("dashboard.empty")}</div>}
          <div className="space-y-2">
            {data.contributions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border border-line p-2.5">
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="flex gap-2 mt-1">
                    <Badge color={categoryColorOf(c.category)}>{t(`category.${c.category}` as MessageKey)}</Badge>
                    <span className="text-[11px] text-dim">{formatNumber(c.eventCount, locale)} {t("dashboard.effects")}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Link href={`/${locale}/contribute`}>
                    <Button variant="ghost" style={{ padding: "4px 8px", fontSize: 11 }}>{t("dashboard.trace")}</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={t("dashboard.recentEvents")}>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.recentEvents.map((ev) => (
              <div key={ev.id} className="flex gap-2 text-xs border-b border-line/50 pb-2">
                <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: eventColorOf(ev.type) }} />
                <div>
                  <div className="font-medium">{ev.title}</div>
                  <div className="text-dim">{ev.summary}</div>
                  <div className="text-[10px] text-dim/70 tabular-nums mt-0.5" dir="ltr">{formatNumber(ev.simYear, locale)}</div>
                </div>
              </div>
            ))}
            {data.recentEvents.length === 0 && <div className="text-dim text-sm">{t("dashboard.empty")}</div>}
          </div>
        </Panel>
      </div>

      <Panel title={t("dashboard.achievements")}>
        <div className="flex flex-wrap gap-2">
          {data.achievements.map((a) => (
            <Badge key={a.key} color="#f5c452">🏅 {a.key}</Badge>
          ))}
          {data.achievements.length === 0 && <span className="text-dim text-sm">—</span>}
        </div>
      </Panel>
    </div>
  );
}

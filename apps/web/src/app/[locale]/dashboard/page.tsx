"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Empty, Panel, Stat, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { TopBar } from "@/components/shell/TopBar";

export default function DashboardPage() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) router.replace(`/${locale}/login`);
  }, [user, router, locale]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api().get<UserDashboard>("/users/me/dashboard"),
    enabled: Boolean(user),
  });
  const { data: contributions, isLoading } = useQuery({
    queryKey: ["my-contributions"],
    queryFn: () => api().myContributions(),
    enabled: Boolean(user),
  });
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api().getNotifications(),
    enabled: Boolean(user),
  });

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{dict.dashboard.title}</h1>
          <Badge tone="civ">{user?.role}</Badge>
        </div>

        <Panel title={dict.dashboard.stats}>
          <div className="pb-grid-stats">
            <Stat value={stats?.appliedContributions ?? "—"} label={dict.dashboard.appliedContributions} tone="nature" />
            <Stat value={stats?.descendantEvents ?? "—"} label={dict.dashboard.descendantEvents} tone="tech" />
            <Stat value={stats?.civilizationsFounded ?? "—"} label={dict.nav.civilizations} tone="civ" />
            <Stat value={stats?.unreadNotifications ?? "—"} label={dict.dashboard.unread} tone="warning" />
          </div>
        </Panel>

        <div style={{ height: 16 }} />
        <Panel title={dict.dashboard.achievements}>
          <div className="pb-chip-row">
            {(stats?.achievements ?? []).length ? (
              (stats?.achievements ?? []).map((a, i) => <Badge key={i} tone="civ">🏅 {a}</Badge>)
            ) : (
              <span className="pb-dim">—</span>
            )}
          </div>
        </Panel>

        <div style={{ height: 16 }} />
        <Panel title={dict.dashboard.contributions}>
          {isLoading ? (
            <Spinner />
          ) : !(contributions ?? []).length ? (
            <Empty>{dict.dashboard.empty}</Empty>
          ) : (
            <div className="grid-cards">
              {(contributions ?? []).map((c) => (
                <Link key={c.id} href={`/${locale}/contributions/${c.id}`} style={{ textDecoration: "none" }}>
                  <Card clickable>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Badge tone="nature">{dict.categories[c.category]}</Badge>
                      <Badge tone={c.status === "applied" ? "nature" : c.status === "previewed" ? "tech" : "warning"}>
                        {c.status}
                      </Badge>
                    </div>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>{c.name}</div>
                    <div className="pb-dim" style={{ fontSize: 12, marginTop: 4 }}>
                      {dict.home.impacts}: {c.impact.descendantEvents} · {dict.home.year} {c.appliedTick ?? "—"}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <div style={{ height: 16 }} />
        <Panel title={dict.common.notifications}>
          {(notifications ?? []).slice(0, 10).map((n) => (
            <div key={n.id} className="pb-event" style={{ opacity: n.read ? 0.55 : 1 }}>
              <div style={{ flex: 1 }}>
                <strong>{n.title}</strong>
                <div className="pb-dim" style={{ fontSize: 12 }}>{n.body}</div>
              </div>
              {!n.read ? (
                <button className="hud-chip" onClick={() => api().markNotificationRead(n.id)}>
                  {dict.common.markRead}
                </button>
              ) : null}
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}

interface UserDashboard {
  appliedContributions: number;
  descendantEvents: number;
  civilizationsFounded: number;
  unreadNotifications: number;
  impactScore: number;
  achievements: string[];
}

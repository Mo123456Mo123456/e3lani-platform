"use client";

/** User dashboard — contributions, statuses, impact links, roles, notifications. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { TopBar } from "@/components/panels/TopBar";
import type { Contribution, User } from "@planet/shared-types";

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [profile, setProfile] = useState<{ user: User; stats: { contributions: number; placed: number; totalImpact: number; unreadNotifications: number } } | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [narratives, setNarratives] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    void api.me().then(setProfile).catch(() => undefined);
    void api.myContributions().then((res) => setContributions(res.contributions)).catch(() => undefined);
  }, [user, router]);

  const showNarrative = async (contribution: Contribution) => {
    if (narratives[contribution.id]) return;
    const res = await api.narrative(contribution.planetId, contribution.id, locale).catch(() => null);
    if (res) setNarratives((prev) => ({ ...prev, [contribution.id]: res.narrative }));
  };

  if (!user) return null;

  return (
    <div className="app-shell">
      <TopBar />
      <div className="dashboard-page">
        <h1>{t.dashboard.title}</h1>
        <p>
          {profile?.user.displayName} · {profile?.user.email}
        </p>
        <p style={{ marginTop: 8 }}>
          {t.dashboard.roles}:{" "}
          {(profile?.user.roles ?? user.roles).map((role) => (
            <span key={role} className="role-chip">{role}</span>
          ))}
        </p>

        <div className="dashboard-grid">
          <section className="dashboard-card">
            <h2>{t.dashboard.myContributions} ({profile?.stats.contributions ?? 0})</h2>
            {contributions.length === 0 && <p className="feed-empty">{t.dashboard.emptyContributions}</p>}
            {contributions.map((c) => (
              <div key={c.id}>
                <div className="contrib-row">
                  <span>{c.structured.name}</span>
                  <span className={c.status === "placed" ? "contrib-status-placed" : "contrib-status-analyzed"}>
                    {c.status === "placed" ? t.dashboard.placed : t.dashboard.analyzed}
                  </span>
                  {c.status === "placed" && (
                    <button className="ghost-btn" onClick={() => void showNarrative(c)}>
                      {t.dashboard.narrative}
                    </button>
                  )}
                </div>
                {narratives[c.id] && <pre className="impact-text">{narratives[c.id]}</pre>}
              </div>
            ))}
          </section>
          <section className="dashboard-card">
            <h2>{t.stats.title}</h2>
            <div className="stats-grid">
              <div><b>{profile?.stats.contributions ?? 0}</b><span>{t.stats.contributions}</span></div>
              <div><b>{profile?.stats.placed ?? 0}</b><span>{t.dashboard.placed}</span></div>
              <div><b>{profile?.stats.unreadNotifications ?? 0}</b><span>{t.stats.unread}</span></div>
            </div>
            <p style={{ marginTop: 16 }}>
              <Link href="/" className="account-btn">{t.nav.home}</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Panel, Button, Stat, Badge } from "@planet/ui";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuthStore, useUiStore, useWorldStore } from "@/lib/store";
import { Wizard } from "../contribute/Wizard";
import { useRouter } from "next/navigation";

interface ContributionRow {
  id: string;
  category: string;
  status: string;
  impactScore: number;
  eventCount: number;
  appliedTick: number | null;
  createdAt: string;
  analysis?: { name?: string } | null;
}

export function ContributePanel() {
  const { t } = useI18n();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { wizardOpen, setWizardOpen } = useUiStore();
  const { worldId, mode } = useWorldStore();

  const { data: mine } = useQuery({
    queryKey: ["my-contributions", user?.id],
    queryFn: () => api<ContributionRow[]>("/contributions/mine", { auth: true }),
    enabled: !!user,
    staleTime: 15_000,
  });

  const totals = (mine ?? []).reduce(
    (acc, c) => ({
      count: acc.count + 1,
      events: acc.events + c.eventCount,
      impact: acc.impact + c.impactScore,
    }),
    { count: 0, events: 0, impact: 0 },
  );

  const openWizard = () => {
    if (!user && mode === "live") {
      router.push("/login");
      return;
    }
    setWizardOpen(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 10, overflow: "hidden" }}>
      {wizardOpen ? (
        <Wizard onClose={() => setWizardOpen(false)} />
      ) : (
        <>
          <Panel style={{ flexShrink: 0 }}>
            <Button
              onClick={openWizard}
              style={{ width: "100%", padding: "14px", fontSize: 15, fontWeight: 600 }}
            >
              ✦ {t.dashboard.addElement}
            </Button>
          </Panel>

          <Panel title={t.dashboard.myImpact} style={{ flexShrink: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stat label={t.dashboard.contributions} value={totals.count} />
              <Stat label={t.dashboard.effects} value={totals.events} color="var(--planet-accent)" />
              <Stat label={t.profile.impactScore} value={Math.round(totals.impact * 10) / 10} color="var(--planet-gold)" />
              <Stat
                label={t.dashboard.lastEvent}
                value={mine?.find((c) => c.appliedTick)?.appliedTick ?? "—"}
              />
            </div>
            {!user && (
              <p style={{ fontSize: 11, color: "var(--planet-text-dim)", marginBottom: 0 }}>
                {t.auth.login} ← {t.dashboard.myImpact}
              </p>
            )}
          </Panel>

          <Panel title={t.profile.myContributions} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="panel-scroll" style={{ flex: 1, overflowY: "auto" }}>
              {(mine ?? []).length === 0 && (
                <p style={{ fontSize: 12, color: "var(--planet-text-dim)" }}>{t.common.noData}</p>
              )}
              {(mine ?? []).map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: "8px 0", borderBottom: "1px solid var(--planet-border)",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {c.analysis?.name ?? t.categories[c.category as keyof typeof t.categories] ?? c.category}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--planet-text-dim)" }}>
                      {t.categories[c.category as keyof typeof t.categories] ?? c.category}
                    </div>
                  </div>
                  <Badge
                    color={
                      c.status === "applied" ? "var(--planet-green)"
                        : c.status === "rejected" ? "var(--planet-red)"
                          : "var(--planet-text-dim)"
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Panel, Stat, Empty } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function RightPanel() {
  const { locale, dict } = useI18n();
  const user = useAuthStore((s) => s.user);

  const { data: contributions } = useQuery({
    queryKey: ["my-contributions"],
    queryFn: () => api().myContributions(),
    enabled: Boolean(user),
  });

  const applied = contributions?.filter((c) => c.status === "applied") ?? [];
  const impacts = applied.reduce((a, c) => a + c.impact.descendantEvents, 0);
  const affectedCivs = applied.reduce((a, c) => a + c.impact.affectedCivs, 0);
  const lastApplied = [...applied].sort((a, b) => (b.appliedTick ?? 0) - (a.appliedTick ?? 0))[0];

  return (
    <aside className="app-right pb-scroll">
      <div className="side-panel">
        <Link href={`/${locale}/add`} style={{ textDecoration: "none" }}>
          <Button variant="primary" size="lg" block>
            ＋ {dict.home.addElement}
          </Button>
        </Link>

        <Panel title={dict.home.yourImpact}>
          {!user ? (
            <Empty>
              <Link href={`/${locale}/login`}>{dict.nav.login}</Link>
            </Empty>
          ) : (
            <>
              <div className="pb-grid-stats">
                <Stat value={applied.length} label={dict.home.contributions} tone="nature" />
                <Stat value={impacts} label={dict.home.impacts} tone="tech" />
                <Stat value={affectedCivs} label={dict.home.affectedCivs} tone="civ" />
                <Stat
                  value={lastApplied?.appliedTick != null ? `${lastApplied.appliedTick}y` : "—"}
                  label={dict.home.impactAge}
                />
              </div>
              {lastApplied ? (
                <Card style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13 }}>
                    <Badge tone="civ">{dict.categories[lastApplied.category]}</Badge>{" "}
                    <strong>{lastApplied.name}</strong>
                    <div className="pb-dim" style={{ marginTop: 4, fontSize: 12 }}>
                      {dict.home.lastEvent}: {dict.home.year} {lastApplied.impact.lastEventAt ?? lastApplied.appliedTick}
                    </div>
                  </div>
                  <Link href={`/${locale}/contributions/${lastApplied.id}`}>
                    <Button size="sm" variant="ghost" style={{ marginTop: 8 }}>
                      {dict.wizard.impactLink} ←
                    </Button>
                  </Link>
                </Card>
              ) : null}
            </>
          )}
        </Panel>
      </div>
    </aside>
  );
}

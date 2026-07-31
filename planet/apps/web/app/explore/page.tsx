"use client";

import React from "react";
import dynamic from "next/dynamic";
import { TopBar } from "@/components/panels/TopBar";
import { useWorld } from "@/lib/useWorld";
import { useI18n } from "@/lib/i18n";
import { Spinner, Panel, Stat } from "@planet/ui";

const PlanetCanvas = dynamic(
  () => import("@/components/planet/PlanetCanvas").then((m) => m.PlanetCanvas),
  { ssr: false, loading: () => <div style={{ display: "grid", placeItems: "center", height: "100%" }}><Spinner size={42} /></div> },
);

/** Explore: full-screen planet with biome distribution panel. */
export default function ExplorePage() {
  const { t, locale } = useI18n();
  const { bundle } = useWorld();

  const biomes = React.useMemo(() => {
    if (!bundle) return [];
    const counts = new Map<number, number>();
    for (const b of bundle.grid.biome) counts.set(b, (counts.get(b) ?? 0) + 1);
    const names = ["ocean", "coast", "plains", "rainforest", "temperate_forest", "desert", "mountains", "tundra", "swamp", "steppe", "volcanic", "ice"];
    const namesAr: Record<string, string> = {
      ocean: "محيط", coast: "ساحل", plains: "سهول", rainforest: "غابة مطيرة", temperate_forest: "غابة معتدلة",
      desert: "صحراء", mountains: "جبال", tundra: "تندرا", swamp: "مستنقع", steppe: "سهوب", volcanic: "بركانية", ice: "جليد",
    };
    return [...counts.entries()]
      .map(([b, count]) => ({ name: names[b] ?? String(b), pct: (count / bundle.grid.biome.length) * 100 }))
      .sort((a, b) => b.pct - a.pct)
      .map((x) => ({ ...x, label: locale === "ar" ? namesAr[x.name] ?? x.name : x.name }));
  }, [bundle, locale]);

  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-main">
        {bundle && <PlanetCanvas grid={bundle.grid} snapshot={bundle.snapshot} />}
        <aside style={{ position: "absolute", top: 70, insetInlineEnd: 16, width: 250, zIndex: 30 }}>
          <Panel title={t.pages.explore}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {biomes.slice(0, 8).map((b) => (
                <div key={b.name} className="trait-bar">
                  <span style={{ width: 90, color: "var(--planet-text-dim)", fontSize: 11 }}>{b.label}</span>
                  <span className="bar"><span className="fill" style={{ width: `${b.pct}%` }} /></span>
                  <span style={{ fontSize: 10, width: 34 }}>{b.pct.toFixed(1)}%</span>
                </div>
              ))}
              {bundle && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <Stat label={t.dashboard.year} value={bundle.meta.year} />
                  <Stat label={t.dashboard.era} value={bundle.snapshot.civs.length > 0 ? t.nav.civilizations : "—"} />
                </div>
              )}
            </div>
          </Panel>
        </aside>
      </main>
    </div>
  );
}

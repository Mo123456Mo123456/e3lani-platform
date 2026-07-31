"use client";

import { Badge, Card, Panel } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { usePlanetStore, type Quality } from "@/lib/planet-store";
import { TopBar } from "@/components/shell/TopBar";

const QUALITIES: Quality[] = ["auto", "ultra", "high", "medium", "saver"];

export default function SettingsPage() {
  const { dict } = useI18n();
  const quality = usePlanetStore((s) => s.quality);
  const setQuality = usePlanetStore((s) => s.setQuality);
  const effects = usePlanetStore((s) => s.effectsEnabled);
  const setEffects = usePlanetStore((s) => s.setEffectsEnabled);
  const effective = usePlanetStore((s) => s.effectiveQuality);

  return (
    <>
      <TopBar />
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="page-header">
          <h1 className="page-title">{dict.settings.title}</h1>
        </div>
        <Panel title={dict.settings.quality}>
          <div className="pb-chip-row">
            {QUALITIES.map((q) => (
              <button
                key={q}
                className={`hud-chip ${quality === q ? "hud-chip--active" : ""}`}
                onClick={() => setQuality(q)}
              >
                {dict.settings[q]}
              </button>
            ))}
          </div>
          <div className="pb-dim" style={{ fontSize: 12, marginTop: 10 }}>
            {dict.settings.auto}: <Badge tone="tech">{dict.settings[effective]}</Badge>
          </div>
        </Panel>
        <div style={{ height: 16 }} />
        <Panel title={dict.settings.effects}>
          <Card clickable onClick={() => setEffects(!effects)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{dict.settings.effects}</span>
              <Badge tone={effects ? "nature" : "danger"}>{effects ? dict.common.active : dict.common.paused}</Badge>
            </div>
          </Card>
        </Panel>
      </div>
    </>
  );
}

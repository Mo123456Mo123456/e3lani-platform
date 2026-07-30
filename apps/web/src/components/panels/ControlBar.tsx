"use client";

/** Layer switcher + graphics quality menu. */
import { useI18n } from "@/i18n/I18nProvider";
import { useAppStore, type Quality } from "@/lib/store";
import { RENDER_LAYERS } from "@planet/shared-types";

const LAYER_ICONS: Record<string, string> = {
  surface: "🌍",
  biome: "🌿",
  weather: "🌦️",
  civilization: "🏛️",
  resource: "⛏️",
  conflict: "⚔️",
  migration: "🚶",
  trade: "🛤️",
  pollution: "🏭",
  temperature: "🌡️",
  historical: "📜",
};

const QUALITIES: Quality[] = ["ultra", "high", "medium", "saver"];

export function ControlBar() {
  const { t } = useI18n();
  const activeLayer = useAppStore((s) => s.activeLayer);
  const setActiveLayer = useAppStore((s) => s.setActiveLayer);
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);

  return (
    <div className="control-bar">
      <div className="layer-switcher" role="tablist" aria-label={t.layers.title}>
        {RENDER_LAYERS.map((layer) => (
          <button
            key={layer}
            role="tab"
            aria-selected={activeLayer === layer}
            className={`layer-btn ${activeLayer === layer ? "active" : ""}`}
            onClick={() => setActiveLayer(layer)}
            title={t.layers[layer]}
          >
            <span aria-hidden>{LAYER_ICONS[layer]}</span>
            <span className="layer-label">{t.layers[layer]}</span>
          </button>
        ))}
      </div>
      <div className="quality-menu">
        {QUALITIES.map((q) => (
          <button
            key={q}
            className={`quality-btn ${quality === q ? "active" : ""}`}
            onClick={() => setQuality(q)}
          >
            {t.quality[q]}
          </button>
        ))}
      </div>
    </div>
  );
}

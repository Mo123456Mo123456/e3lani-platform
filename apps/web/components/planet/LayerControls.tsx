"use client";

import { usePlanetStore, type LayerId } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { QUALITY_PRESETS, type QualityLevel } from "@/lib/quality";
import { Badge } from "@/components/ui/Badge";

const LAYER_KEYS: LayerId[] = [
  "plants",
  "creatures",
  "weather",
  "disasters",
  "civilizations",
  "inventions",
  "migrations",
  "wars",
];

const LAYER_TONES: Record<LayerId, "green" | "cyan" | "muted" | "orange" | "gold" | "purple" | "red"> = {
  plants: "green",
  creatures: "cyan",
  weather: "muted",
  disasters: "orange",
  civilizations: "gold",
  inventions: "purple",
  migrations: "purple",
  wars: "red",
};

export function LayerControls() {
  const locale = usePlanetStore((s) => s.locale);
  const layers = usePlanetStore((s) => s.layers);
  const toggleLayer = usePlanetStore((s) => s.toggleLayer);
  const quality = usePlanetStore((s) => s.quality);
  const setQuality = usePlanetStore((s) => s.setQuality);
  const dict = t(locale);

  return (
    <div className="pointer-events-auto absolute bottom-3 start-3 z-20 max-w-[220px] space-y-2">
      <div className="glass-panel p-2.5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {dict.layers.title}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LAYER_KEYS.map((k) => (
            <button key={k} type="button" onClick={() => toggleLayer(k)}>
              <Badge tone={layers[k] ? LAYER_TONES[k] : "muted"} className={!layers[k] ? "opacity-40" : ""}>
                {dict.layers[k]}
              </Badge>
            </button>
          ))}
        </div>
      </div>
      <div className="glass-panel flex items-center gap-2 p-2">
        <span className="text-[10px] text-muted">{dict.quality.label}</span>
        {(Object.keys(QUALITY_PRESETS) as QualityLevel[]).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuality(q)}
            className={`rounded px-1.5 py-0.5 text-[10px] ${
              quality === q ? "bg-cyan/20 text-cyan" : "text-muted hover:text-ink"
            }`}
          >
            {dict.quality[q]}
          </button>
        ))}
      </div>
    </div>
  );
}

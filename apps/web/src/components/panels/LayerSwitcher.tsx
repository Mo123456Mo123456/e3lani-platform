"use client";

import { LAYER_IDS, type LayerId } from "@kawkab/shared-types";
import { useWorldStore } from "@/lib/store";
import { useT } from "../LocaleProvider";
import type { MessageKey } from "@/i18n";

export function LayerSwitcher() {
  const { t } = useT();
  const activeLayer = useWorldStore((s) => s.activeLayer);
  const setLayer = useWorldStore((s) => s.setLayer);
  return (
    <div className="flex flex-wrap gap-1">
      {LAYER_IDS.map((layer: LayerId) => (
        <button
          key={layer}
          onClick={() => setLayer(layer)}
          className={`text-[11px] px-2 py-1 rounded border ${
            activeLayer === layer ? "border-tech text-tech bg-tech/10" : "border-line text-dim hover:text-white"
          }`}
        >
          {t(`layer.${layer}` as MessageKey)}
        </button>
      ))}
    </div>
  );
}

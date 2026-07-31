"use client";

import React from "react";
import { RenderLayer, GraphicsQuality } from "@planet/shared-types";
import { useI18n } from "@/lib/i18n";
import { useUiStore } from "@/lib/store";

const LAYERS: RenderLayer[] = [
  RenderLayer.Surface, RenderLayer.Biome, RenderLayer.Weather, RenderLayer.Civilization,
  RenderLayer.Resource, RenderLayer.Conflict, RenderLayer.Migration, RenderLayer.Trade,
  RenderLayer.Pollution, RenderLayer.Temperature,
];

const QUALITIES: GraphicsQuality[] = [
  GraphicsQuality.Ultra, GraphicsQuality.High, GraphicsQuality.Medium, GraphicsQuality.PowerSaver,
];

export function LayerToggles() {
  const { t } = useI18n();
  const { activeLayers, toggleLayer, quality, setQuality } = useUiStore();

  return (
    <div
      style={{
        position: "absolute", top: 64, insetInlineStart: 16, zIndex: 30,
        display: "flex", flexDirection: "column", gap: 6, maxWidth: 180,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {LAYERS.map((layer) => (
          <button
            key={layer}
            className={`chip ${activeLayers.has(layer) ? "active" : ""}`}
            onClick={() => toggleLayer(layer)}
            style={{ backdropFilter: "blur(8px)", background: "rgba(5,10,20,0.6)" }}
          >
            {t.layers[layer]}
          </button>
        ))}
      </div>
      <select
        className="input"
        style={{ width: 130, fontSize: 11, background: "rgba(5,10,20,0.7)" }}
        value={quality}
        onChange={(e) => setQuality(e.target.value as GraphicsQuality)}
        title={t.quality.title}
      >
        {QUALITIES.map((q) => (
          <option key={q} value={q}>{t.quality[q]}</option>
        ))}
      </select>
    </div>
  );
}

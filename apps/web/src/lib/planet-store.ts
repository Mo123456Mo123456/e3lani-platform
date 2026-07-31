"use client";

import { create } from "zustand";
import type { MapLayer } from "@planet/shared-types";

export type Quality = "auto" | "ultra" | "high" | "medium" | "saver";

interface OverlayFlags {
  cities: boolean;
  trade: boolean;
  migrations: boolean;
  wars: boolean;
  events: boolean;
}

interface PlanetState {
  planetId: string | null;
  layer: MapLayer;
  overlays: OverlayFlags;
  selectedCell: number | null;
  quality: Quality;
  effectiveQuality: Exclude<Quality, "auto">;
  effectsEnabled: boolean;
  eraFilter: { from: number; to: number } | null;
  setPlanetId: (id: string) => void;
  setLayer: (layer: MapLayer) => void;
  toggleOverlay: (key: keyof OverlayFlags) => void;
  setSelectedCell: (cell: number | null) => void;
  setQuality: (q: Quality) => void;
  setEffectiveQuality: (q: Exclude<Quality, "auto">) => void;
  setEffectsEnabled: (v: boolean) => void;
  setEraFilter: (era: { from: number; to: number } | null) => void;
}

export const usePlanetStore = create<PlanetState>()((set) => ({
  planetId: null,
  layer: "biome",
  overlays: { cities: true, trade: true, migrations: true, wars: true, events: true },
  selectedCell: null,
  quality: "auto",
  effectiveQuality: "high",
  effectsEnabled: true,
  eraFilter: null,
  setPlanetId: (id) => set({ planetId: id }),
  setLayer: (layer) => set({ layer }),
  toggleOverlay: (key) => set((s) => ({ overlays: { ...s.overlays, [key]: !s.overlays[key] } })),
  setSelectedCell: (cell) => set({ selectedCell: cell }),
  setQuality: (quality) => set({ quality }),
  setEffectiveQuality: (effectiveQuality) => set({ effectiveQuality }),
  setEffectsEnabled: (effectsEnabled) => set({ effectsEnabled }),
  setEraFilter: (eraFilter) => set({ eraFilter }),
}));

"use client";

import { create } from "zustand";

export type QualityPreset = "ultra" | "high" | "medium" | "battery";

type Layer =
  | "surface"
  | "biome"
  | "weather"
  | "civilization"
  | "resource"
  | "conflict"
  | "migration"
  | "trade"
  | "pollution"
  | "temperature"
  | "historical";

type WorldUiState = {
  planetId: string | null;
  selectedRegionId: string | null;
  activeLayer: Layer;
  quality: QualityPreset;
  playing: boolean;
  addOpen: boolean;
  compareSnapshotLabel: string | null;
  setPlanetId: (id: string) => void;
  selectRegion: (id: string | null) => void;
  setLayer: (layer: Layer) => void;
  setQuality: (q: QualityPreset) => void;
  setPlaying: (v: boolean) => void;
  setAddOpen: (v: boolean) => void;
};

export const useWorldUi = create<WorldUiState>((set) => ({
  planetId: null,
  selectedRegionId: null,
  activeLayer: "surface",
  quality: "high",
  playing: true,
  addOpen: false,
  compareSnapshotLabel: null,
  setPlanetId: (planetId) => set({ planetId }),
  selectRegion: (selectedRegionId) => set({ selectedRegionId }),
  setLayer: (activeLayer) => set({ activeLayer }),
  setQuality: (quality) => set({ quality }),
  setPlaying: (playing) => set({ playing }),
  setAddOpen: (addOpen) => set({ addOpen }),
}));

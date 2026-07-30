import type { PlanetRegion } from "@planet/shared-types";
import { create } from "zustand";

export type WorldLayer =
  | "surface"
  | "biome"
  | "temperature"
  | "pollution"
  | "civilization";
export type GraphicsQuality = "ultra" | "high" | "medium" | "power-saver";

interface WorldUiState {
  selectedRegion: PlanetRegion | null;
  layer: WorldLayer;
  quality: GraphicsQuality;
  locale: "ar" | "en";
  contributionOpen: boolean;
  setSelectedRegion: (region: PlanetRegion | null) => void;
  setLayer: (layer: WorldLayer) => void;
  setQuality: (quality: GraphicsQuality) => void;
  toggleLocale: () => void;
  setContributionOpen: (open: boolean) => void;
}

export const useWorldStore = create<WorldUiState>((set) => ({
  selectedRegion: null,
  layer: "surface",
  quality: "high",
  locale: "ar",
  contributionOpen: false,
  setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
  setLayer: (layer) => set({ layer }),
  setQuality: (quality) => set({ quality }),
  toggleLocale: () =>
    set((state) => ({ locale: state.locale === "ar" ? "en" : "ar" })),
  setContributionOpen: (contributionOpen) => set({ contributionOpen }),
}));

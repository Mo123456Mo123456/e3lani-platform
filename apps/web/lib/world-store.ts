"use client";

import { create } from "zustand";

export type WorldLayer =
  | "surface"
  | "biome"
  | "weather"
  | "civilization"
  | "resource"
  | "conflict"
  | "migration"
  | "trade"
  | "pollution"
  | "temperature";

interface WorldUiState {
  locale: "ar" | "en";
  selectedRegionId?: string;
  activeLayer: WorldLayer;
  contributionOpen: boolean;
  quality: "ultra" | "high" | "medium" | "eco";
  setLocale(locale: "ar" | "en"): void;
  selectRegion(id?: string): void;
  setLayer(layer: WorldLayer): void;
  setContributionOpen(open: boolean): void;
  setQuality(quality: WorldUiState["quality"]): void;
}

export const useWorldUi = create<WorldUiState>((set) => ({
  locale: "ar",
  activeLayer: "surface",
  contributionOpen: false,
  quality: "high",
  setLocale: (locale) => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    set({ locale });
  },
  selectRegion: (selectedRegionId) => set({ selectedRegionId }),
  setLayer: (activeLayer) => set({ activeLayer }),
  setContributionOpen: (contributionOpen) => set({ contributionOpen }),
  setQuality: (quality) => set({ quality }),
}));

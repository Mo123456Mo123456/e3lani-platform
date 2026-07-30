import type { AuthUser, RegionSummary } from "@living-planet/shared-types";
import { create } from "zustand";

export type GlobeLayer =
  | "surface"
  | "biome"
  | "weather"
  | "civilization"
  | "resource"
  | "conflict"
  | "pollution"
  | "temperature";
export type GraphicsQuality = "ultra" | "high" | "medium" | "eco";

interface WorldUiState {
  locale: "ar" | "en";
  selectedRegion: RegionSummary | null;
  layer: GlobeLayer;
  quality: GraphicsQuality;
  wizardOpen: boolean;
  authOpen: boolean;
  user: AuthUser | null;
  setLocale(locale: "ar" | "en"): void;
  selectRegion(region: RegionSummary | null): void;
  setLayer(layer: GlobeLayer): void;
  setQuality(quality: GraphicsQuality): void;
  setWizardOpen(open: boolean): void;
  setAuthOpen(open: boolean): void;
  setUser(user: AuthUser | null): void;
}

export const useWorldStore = create<WorldUiState>((set) => ({
  locale: "ar",
  selectedRegion: null,
  layer: "surface",
  quality: "high",
  wizardOpen: false,
  authOpen: false,
  user: null,
  setLocale: (locale) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    }
    set({ locale });
  },
  selectRegion: (selectedRegion) => set({ selectedRegion }),
  setLayer: (layer) => set({ layer }),
  setQuality: (quality) => set({ quality }),
  setWizardOpen: (wizardOpen) => set({ wizardOpen }),
  setAuthOpen: (authOpen) => set({ authOpen }),
  setUser: (user) => set({ user }),
}));


import { create } from "zustand";
import type { Locale } from "../lib/i18n";

export type Quality = "low" | "medium" | "high";
export type PlanetLayer = "biomes" | "temperature" | "resources";

interface WorldStore {
  locale: Locale;
  quality: Quality;
  layer: PlanetLayer;
  token: string;
  setLocale(locale: Locale): void;
  setQuality(quality: Quality): void;
  setLayer(layer: PlanetLayer): void;
  setToken(token: string): void;
}

export const useWorldStore = create<WorldStore>((set) => ({
  locale: "ar",
  quality: "medium",
  layer: "biomes",
  token: "",
  setLocale: (locale) => set({ locale }),
  setQuality: (quality) => set({ quality }),
  setLayer: (layer) => set({ layer }),
  setToken: (token) => {
    if (typeof window !== "undefined") localStorage.setItem("kawkab-token", token);
    set({ token });
  }
}));

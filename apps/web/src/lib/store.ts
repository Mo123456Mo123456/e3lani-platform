"use client";

import { create } from "zustand";
import type { PlanetRegion } from "@planet/shared-types";

export type GraphicsQuality = "ultra" | "high" | "medium" | "eco";

interface UiState {
  locale: "ar" | "en";
  quality: GraphicsQuality;
  selectedRegion: PlanetRegion | null;
  accessToken: string | null;
  setLocale: (locale: "ar" | "en") => void;
  setQuality: (quality: GraphicsQuality) => void;
  selectRegion: (region: PlanetRegion | null) => void;
  setAccessToken: (token: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  locale: "ar",
  quality: "high",
  selectedRegion: null,
  accessToken: null,
  setLocale: (locale) => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    localStorage.setItem("planet-locale", locale);
    set({ locale });
  },
  setQuality: (quality) => {
    localStorage.setItem("planet-quality", quality);
    set({ quality });
  },
  selectRegion: (selectedRegion) => set({ selectedRegion }),
  setAccessToken: (accessToken) => set({ accessToken }),
}));

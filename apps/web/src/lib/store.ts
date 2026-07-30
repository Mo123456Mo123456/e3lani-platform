"use client";

import { create } from "zustand";
import type { GraphicsQuality, Locale, PlanetLayer } from "@planet/shared-types";

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  level: number;
  xp: number;
  locale: Locale;
}

interface AppState {
  locale: Locale;
  user: AuthUser | null;
  selectedRegionId: string | null;
  activeLayer: PlanetLayer;
  quality: GraphicsQuality;
  timePlaying: boolean;
  lastComparison: { before: Record<string, number>; after: Record<string, number> } | null;
  setLocale: (l: Locale) => void;
  setUser: (u: AuthUser | null) => void;
  setSelectedRegionId: (id: string | null) => void;
  setActiveLayer: (l: PlanetLayer) => void;
  setQuality: (q: GraphicsQuality) => void;
  setTimePlaying: (v: boolean) => void;
  setLastComparison: (c: AppState["lastComparison"]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  locale: "ar",
  user: null,
  selectedRegionId: null,
  activeLayer: "surface",
  quality: "high",
  timePlaying: false,
  lastComparison: null,
  setLocale: (locale) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
      localStorage.setItem("pb_locale", locale);
    }
    set({ locale });
  },
  setUser: (user) => set({ user }),
  setSelectedRegionId: (selectedRegionId) => set({ selectedRegionId }),
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  setQuality: (quality) => set({ quality }),
  setTimePlaying: (timePlaying) => set({ timePlaying }),
  setLastComparison: (lastComparison) => set({ lastComparison }),
}));

"use client";

import { create } from "zustand";
import type { GraphicsQuality, PlanetLayer } from "@/types/domain";

const QUALITY_KEY = "planet.graphics.quality";
const LAYER_KEY = "planet.active.layer";

interface PlanetState {
  activeLayer: PlanetLayer;
  selectedRegionId: string | null;
  quality: GraphicsQuality;
  hydrated: boolean;
  setActiveLayer: (layer: PlanetLayer) => void;
  setSelectedRegionId: (regionId: string | null) => void;
  setQuality: (quality: GraphicsQuality) => void;
  hydrate: () => void;
}

function detectDefaultQuality(): GraphicsQuality {
  if (typeof window === "undefined") {
    return "high";
  }

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 760px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    return "power_saver";
  }

  return coarse || narrow ? "medium" : "high";
}

function isQuality(value: string | null): value is GraphicsQuality {
  return value === "ultra" || value === "high" || value === "medium" || value === "power_saver";
}

function isLayer(value: string | null): value is PlanetLayer {
  return (
    value === "surface" ||
    value === "biome" ||
    value === "weather" ||
    value === "civilization" ||
    value === "resource" ||
    value === "conflict" ||
    value === "migration" ||
    value === "trade" ||
    value === "pollution" ||
    value === "temperature" ||
    value === "historical"
  );
}

export const usePlanetStore = create<PlanetState>((set) => ({
  activeLayer: "surface",
  selectedRegionId: null,
  quality: "high",
  hydrated: false,
  setActiveLayer: (activeLayer) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAYER_KEY, activeLayer);
    }
    set({ activeLayer });
  },
  setSelectedRegionId: (selectedRegionId) => set({ selectedRegionId }),
  setQuality: (quality) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(QUALITY_KEY, quality);
    }
    set({ quality });
  },
  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }

    const storedQuality = window.localStorage.getItem(QUALITY_KEY);
    const storedLayer = window.localStorage.getItem(LAYER_KEY);
    set({
      activeLayer: isLayer(storedLayer) ? storedLayer : "surface",
      quality: isQuality(storedQuality) ? storedQuality : detectDefaultQuality(),
      hydrated: true,
    });
  },
}));

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QualityLevel } from "./quality";
import { detectDefaultQuality } from "./quality";

export type Locale = "ar" | "en";

export type LayerId =
  | "plants"
  | "creatures"
  | "weather"
  | "disasters"
  | "civilizations"
  | "inventions"
  | "migrations"
  | "wars";

export type SelectedRegion = {
  id?: string;
  lat: number;
  lon: number;
  name?: string;
  biome?: string;
} | null;

type PlanetState = {
  planetId: string | null;
  planetSeed: string;
  planetName: string;
  selectedRegion: SelectedRegion;
  layers: Record<LayerId, boolean>;
  tick: number;
  maxTick: number;
  playing: boolean;
  quality: QualityLevel;
  locale: Locale;
  timelinePosition: number;
  regionDrawerOpen: boolean;
  setPlanet: (p: { id: string; seed: string; name: string; tick?: number }) => void;
  setSelectedRegion: (r: SelectedRegion) => void;
  toggleLayer: (id: LayerId) => void;
  setTick: (t: number) => void;
  setMaxTick: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setQuality: (q: QualityLevel) => void;
  setLocale: (l: Locale) => void;
  setTimelinePosition: (p: number) => void;
  setRegionDrawerOpen: (o: boolean) => void;
};

const defaultLayers: Record<LayerId, boolean> = {
  plants: true,
  creatures: true,
  weather: true,
  disasters: true,
  civilizations: true,
  inventions: true,
  migrations: true,
  wars: true,
};

export const usePlanetStore = create<PlanetState>()(
  persist(
    (set) => ({
      planetId: null,
      planetSeed: "genesis-alpha-2026",
      planetName: "ألفا التكوين",
      selectedRegion: null,
      layers: defaultLayers,
      tick: 50,
      maxTick: 50,
      playing: false,
      quality: detectDefaultQuality(),
      locale: "ar",
      timelinePosition: 1,
      regionDrawerOpen: false,
      setPlanet: (p) =>
        set({
          planetId: p.id,
          planetSeed: p.seed,
          planetName: p.name,
          tick: p.tick ?? 50,
          maxTick: p.tick ?? 50,
        }),
      setSelectedRegion: (r) => set({ selectedRegion: r, regionDrawerOpen: !!r }),
      toggleLayer: (id) =>
        set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
      setTick: (t) => set({ tick: t }),
      setMaxTick: (t) => set({ maxTick: t }),
      setPlaying: (p) => set({ playing: p }),
      setQuality: (q) => set({ quality: q }),
      setLocale: (l) => set({ locale: l }),
      setTimelinePosition: (p) => set({ timelinePosition: p }),
      setRegionDrawerOpen: (o) => set({ regionDrawerOpen: o }),
    }),
    {
      name: "planet-ui",
      partialize: (s) => ({
        quality: s.quality,
        locale: s.locale,
        layers: s.layers,
      }),
    },
  ),
);

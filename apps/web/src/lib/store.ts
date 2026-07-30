"use client";

import { create } from "zustand";
import type {
  LayerId,
  PlanetStats,
  QualityPreset,
  RegionData,
  SessionUser,
  WorldDelta,
  WorldEvent,
} from "@kawkab/shared-types";

interface WorldStore {
  planetId: string | null;
  seed: string | null;
  gridWidth: number;
  gridHeight: number;
  connected: boolean;
  tick: number;
  simYear: number;
  stats: PlanetStats | null;
  feed: WorldEvent[];
  deltasSeen: number;
  activeLayer: LayerId;
  selectedRegion: number | null;
  selectedRegionData: (RegionData & { civName?: string; cityName?: string }) | null;
  timelineCursor: number | null; // null = live
  compareTicks: [number, number] | null;
  quality: QualityPreset;
  autoQuality: boolean;
  heavyEffects: boolean;
  user: SessionUser | null;

  setPlanet: (p: { planetId: string; seed: string; gridWidth: number; gridHeight: number }) => void;
  setConnected: (v: boolean) => void;
  setStats: (stats: PlanetStats) => void;
  applyDelta: (delta: WorldDelta) => void;
  pushEvent: (event: WorldEvent) => void;
  setLayer: (layer: LayerId) => void;
  selectRegion: (index: number | null, data?: (RegionData & { civName?: string; cityName?: string }) | null) => void;
  setTimelineCursor: (tick: number | null) => void;
  setCompare: (ticks: [number, number] | null) => void;
  setQuality: (q: QualityPreset) => void;
  setAutoQuality: (v: boolean) => void;
  setHeavyEffects: (v: boolean) => void;
  setUser: (u: SessionUser | null) => void;
}

export const useWorldStore = create<WorldStore>((set) => ({
  planetId: null,
  seed: null,
  gridWidth: 144,
  gridHeight: 72,
  connected: false,
  tick: 0,
  simYear: 0,
  stats: null,
  feed: [],
  deltasSeen: 0,
  activeLayer: "surface",
  selectedRegion: null,
  selectedRegionData: null,
  timelineCursor: null,
  compareTicks: null,
  quality: "high",
  autoQuality: true,
  heavyEffects: true,
  user: null,

  setPlanet: (p) => set(p),
  setConnected: (connected) => set({ connected }),
  setStats: (stats) => set({ stats, tick: stats.tick, simYear: stats.simYear }),
  applyDelta: (delta) =>
    set((s) => ({
      stats: delta.stats,
      tick: delta.toTick,
      simYear: delta.simYear,
      deltasSeen: s.deltasSeen + 1,
      feed: mergeFeed(s.feed, delta.newEvents),
    })),
  pushEvent: (event) => set((s) => ({ feed: mergeFeed(s.feed, [event]) })),
  setLayer: (activeLayer) => set({ activeLayer }),
  selectRegion: (selectedRegion, data) => set({ selectedRegion, selectedRegionData: data ?? null }),
  setTimelineCursor: (timelineCursor) => set({ timelineCursor }),
  setCompare: (compareTicks) => set({ compareTicks }),
  setQuality: (quality) => set({ quality }),
  setAutoQuality: (autoQuality) => set({ autoQuality }),
  setHeavyEffects: (heavyEffects) => set({ heavyEffects }),
  setUser: (user) => set({ user }),
}));

function mergeFeed(feed: WorldEvent[], incoming: WorldEvent[]): WorldEvent[] {
  if (incoming.length === 0) return feed;
  const seen = new Set(feed.map((e) => e.id));
  const fresh = incoming.filter((e) => !seen.has(e.id));
  if (fresh.length === 0) return feed;
  return [...fresh.reverse(), ...feed].slice(0, 200);
}

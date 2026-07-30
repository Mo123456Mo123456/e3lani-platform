import { create } from "zustand";
import type { WorldEvent } from "./api";

export type PlanetLocation = { latitude: number; longitude: number };
export type Quality = "ultra" | "high" | "medium" | "power_saver";

type WorldState = {
  events: WorldEvent[];
  selectedLocation: PlanetLocation | null;
  quality: Quality;
  timelinePlaying: boolean;
  wizardOpen: boolean;
  setEvents: (events: WorldEvent[]) => void;
  pushEvent: (event: WorldEvent) => void;
  setSelectedLocation: (location: PlanetLocation) => void;
  setQuality: (quality: Quality) => void;
  toggleTimeline: () => void;
  setWizardOpen: (open: boolean) => void;
};

export const useWorldStore = create<WorldState>((set) => ({
  events: [],
  selectedLocation: null,
  quality: "high",
  timelinePlaying: false,
  wizardOpen: false,
  setEvents: (events) => set({ events }),
  pushEvent: (event) =>
    set((state) => ({ events: [event, ...state.events.filter((item) => item.id !== event.id)].slice(0, 24) })),
  setSelectedLocation: (selectedLocation) => set({ selectedLocation }),
  setQuality: (quality) => set({ quality }),
  toggleTimeline: () => set((state) => ({ timelinePlaying: !state.timelinePlaying })),
  setWizardOpen: (wizardOpen) => set({ wizardOpen }),
}));

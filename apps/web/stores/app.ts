import { create } from "zustand";
import type { AuthUser } from "@/lib/api";

export type Locale = "ar" | "en";

type WorldEvent = {
  id: string;
  type: string;
  tick: number;
  year: number;
  regionId: string | null;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  importance: number;
  cause: string | null;
};

type AppState = {
  locale: Locale;
  user: AuthUser | null;
  tick: number;
  year: number;
  events: WorldEvent[];
  selectedRegionId: string | null;
  graphicsQuality: "ultra" | "high" | "medium" | "power_saver";
  layer: string;
  addModalOpen: boolean;
  notifications: {
    id: string;
    title: string;
    titleAr: string;
    body: string;
    bodyAr: string;
    kind: string;
  }[];
  setLocale: (l: Locale) => void;
  setUser: (u: AuthUser | null) => void;
  setTick: (tick: number, year: number) => void;
  pushEvent: (e: WorldEvent) => void;
  setEvents: (e: WorldEvent[]) => void;
  selectRegion: (id: string | null) => void;
  setQuality: (q: AppState["graphicsQuality"]) => void;
  setLayer: (l: string) => void;
  setAddModal: (o: boolean) => void;
  pushNotification: (n: AppState["notifications"][0]) => void;
};

export const useAppStore = create<AppState>((set) => ({
  locale: "ar",
  user: null,
  tick: 0,
  year: -1000,
  events: [],
  selectedRegionId: null,
  graphicsQuality: "high",
  layer: "surface",
  addModalOpen: false,
  notifications: [],
  setLocale: (locale) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    }
    set({ locale });
  },
  setUser: (user) => set({ user }),
  setTick: (tick, year) => set({ tick, year }),
  pushEvent: (e) =>
    set((s) => ({ events: [e, ...s.events].slice(0, 80) })),
  setEvents: (events) => set({ events }),
  selectRegion: (selectedRegionId) => set({ selectedRegionId }),
  setQuality: (graphicsQuality) => set({ graphicsQuality }),
  setLayer: (layer) => set({ layer }),
  setAddModal: (addModalOpen) => set({ addModalOpen }),
  pushNotification: (n) =>
    set((s) => ({ notifications: [n, ...s.notifications].slice(0, 30) })),
}));

"use client";

/**
 * Central client state (zustand): session, planet, realtime feed, UI modes.
 */
import { create } from "zustand";
import type {
  Notification,
  PlanetCell,
  RenderLayer,
  StateDelta,
  User,
  WorldEvent,
} from "@planet/shared-types";
import type { PlanetGrid } from "@planet/simulation-models";
import { loadSession, saveSession, type Session } from "./api";

export type Quality = "saver" | "medium" | "high" | "ultra";

interface PlanetConfig {
  planetId: string;
  seed: string;
  latBands: number;
  lonBands: number;
  seaLevel: number;
  currentTick: number;
  currentYear: number;
  riverCount?: number;
  resourceDensity?: number;
}

interface WizardState {
  open: boolean;
  step: number;
  category: string | null;
  text: string;
  analysisId: string | null;
  placementCell: number | null;
  pickingLocation: boolean;
  placedContributionId: string | null;
}

interface AppState {
  // session
  user: User | null;
  setSession: (session: Session | null) => void;

  // planet
  planetConfig: PlanetConfig | null;
  grid: PlanetGrid | null;
  overlay: { owners: Record<number, string>; pollution: Record<number, number> } | null;
  setPlanetConfig: (config: PlanetConfig) => void;
  setGrid: (grid: PlanetGrid) => void;
  setOverlay: (overlay: AppState["overlay"]) => void;

  // live world
  tick: number;
  year: number;
  events: WorldEvent[];
  notifications: Notification[];
  connected: boolean;
  applyTick: (tick: number, year: number) => void;
  appendEvents: (events: WorldEvent[]) => void;
  appendNotification: (notification: Notification) => void;
  setNotifications: (notifications: Notification[]) => void;
  setConnected: (connected: boolean) => void;
  applyDelta: (delta: StateDelta) => void;

  // UI
  activeLayer: RenderLayer;
  setActiveLayer: (layer: RenderLayer) => void;
  quality: Quality;
  setQuality: (quality: Quality) => void;
  selectedCell: number | null;
  setSelectedCell: (cell: number | null) => void;
  civsModalOpen: boolean;
  setCivsModalOpen: (open: boolean) => void;
  notifOpen: boolean;
  setNotifOpen: (open: boolean) => void;
  timelineTick: number | null; // null = present
  setTimelineTick: (tick: number | null) => void;

  wizard: WizardState;
  patchWizard: (patch: Partial<WizardState>) => void;
  resetWizard: () => void;
}

const INITIAL_WIZARD: WizardState = {
  open: false,
  step: 0,
  category: null,
  text: "",
  analysisId: null,
  placementCell: null,
  pickingLocation: false,
  placedContributionId: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  setSession: (session) => {
    saveSession(session);
    set({ user: session?.user ?? null });
  },

  planetConfig: null,
  grid: null,
  overlay: null,
  setPlanetConfig: (planetConfig) => set({ planetConfig }),
  setGrid: (grid) => set({ grid }),
  setOverlay: (overlay) => set({ overlay }),

  tick: 0,
  year: 0,
  events: [],
  notifications: [],
  connected: false,
  applyTick: (tick, year) => set({ tick, year }),
  appendEvents: (incoming) =>
    set((state) => ({ events: [...incoming.reverse(), ...state.events].slice(0, 300) })),
  appendNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications].slice(0, 100) })),
  setNotifications: (notifications) => set({ notifications }),
  setConnected: (connected) => set({ connected }),
  applyDelta: (delta) => {
    const { grid } = get();
    if (grid) {
      for (const [idxStr, change] of Object.entries(delta.cells)) {
        const cell: PlanetCell | undefined = grid.cells[Number(idxStr)];
        if (!cell) continue;
        if (change.ownerId !== undefined) cell.ownerId = change.ownerId;
        if (change.pollution !== undefined) cell.pollution = change.pollution;
        if (change.temperature !== undefined) cell.temperature = change.temperature;
        if (change.moisture !== undefined) cell.moisture = change.moisture;
      }
    }
    set((state) => ({ tick: Math.max(state.tick, delta.tick) }));
  },

  activeLayer: "surface",
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  quality: "high",
  setQuality: (quality) => set({ quality }),
  selectedCell: null,
  setSelectedCell: (selectedCell) => set({ selectedCell }),
  civsModalOpen: false,
  setCivsModalOpen: (civsModalOpen) => set({ civsModalOpen }),
  notifOpen: false,
  setNotifOpen: (notifOpen) => set({ notifOpen }),
  timelineTick: null,
  setTimelineTick: (timelineTick) => set({ timelineTick }),

  wizard: INITIAL_WIZARD,
  patchWizard: (patch) => set((state) => ({ wizard: { ...state.wizard, ...patch } })),
  resetWizard: () => set({ wizard: INITIAL_WIZARD }),
}));

export { loadSession };

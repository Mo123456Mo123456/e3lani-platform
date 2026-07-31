"use client";

import { create } from "zustand";
import type {
  GraphicsQuality,
  NotificationPayload,
  RenderLayer,
  RegionInfo,
  WorldEvent,
  WorldMeta,
  WorldSnapshotView,
} from "@planet/shared-types";
import { EVENT_FEED_RING_BUFFER } from "@planet/config";

interface AuthUser {
  id: string;
  email: string;
  role: string;
  displayName?: string;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

interface WorldState_ {
  worldId: string | null;
  meta: WorldMeta | null;
  snapshot: WorldSnapshotView | null;
  mode: "connecting" | "live" | "local-preview";
  setWorld: (id: string, meta: WorldMeta, snapshot: WorldSnapshotView) => void;
  setMode: (m: WorldState_["mode"]) => void;
}

export const useWorldStore = create<WorldState_>((set) => ({
  worldId: null,
  meta: null,
  snapshot: null,
  mode: "connecting",
  setWorld: (worldId, meta, snapshot) => set({ worldId, meta, snapshot }),
  setMode: (mode) => set({ mode }),
}));

/**
 * Ring-buffered event store — survives tens of thousands of events without
 * degrading the UI (bounded memory, O(1) push).
 */
interface EventsState {
  events: WorldEvent[];
  total: number;
  connected: boolean;
  push: (e: WorldEvent) => void;
  prependMany: (es: WorldEvent[]) => void;
  setTotal: (n: number) => void;
  setConnected: (c: boolean) => void;
  clear: () => void;
}

export const useEventsStore = create<EventsState>((set) => ({
  events: [],
  total: 0,
  connected: false,
  push: (e) =>
    set((s) => {
      if (s.events.some((x) => x.seq === e.seq)) return s;
      const events = [e, ...s.events];
      if (events.length > EVENT_FEED_RING_BUFFER) events.length = EVENT_FEED_RING_BUFFER;
      return { events, total: s.total + 1 };
    }),
  prependMany: (es) =>
    set((s) => {
      // Pages arrive newest-first (desc) and are older than live events,
      // so they append after the current buffer, preserving desc order.
      const existing = new Set(s.events.map((x) => x.seq));
      const fresh = es.filter((x) => !existing.has(x.seq));
      const events = [...s.events, ...fresh];
      if (events.length > EVENT_FEED_RING_BUFFER) events.length = EVENT_FEED_RING_BUFFER;
      return { events };
    }),
  setTotal: (total) => set({ total }),
  setConnected: (connected) => set({ connected }),
  clear: () => set({ events: [], total: 0 }),
}));

interface UiState {
  activeLayers: Set<RenderLayer>;
  toggleLayer: (l: RenderLayer) => void;
  quality: GraphicsQuality;
  setQuality: (q: GraphicsQuality) => void;
  selectedCell: number | null;
  region: RegionInfo | null;
  selectCell: (cell: number | null, region?: RegionInfo | null) => void;
  wizardOpen: boolean;
  setWizardOpen: (open: boolean) => void;
  wizardPickMode: boolean;
  setWizardPickMode: (on: boolean) => void;
  timelineTick: number | null; // null = present
  setTimelineTick: (t: number | null) => void;
  notifications: NotificationPayload[];
  pushNotification: (n: NotificationPayload) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  activeLayers: new Set<RenderLayer>(["surface" as RenderLayer, "civilization" as RenderLayer, "weather" as RenderLayer]),
  toggleLayer: (l) => {
    const next = new Set(get().activeLayers);
    if (next.has(l)) next.delete(l);
    else next.add(l);
    set({ activeLayers: next });
  },
  quality: "high" as GraphicsQuality,
  setQuality: (quality) => set({ quality }),
  selectedCell: null,
  region: null,
  selectCell: (selectedCell, region = null) => set({ selectedCell, region }),
  wizardOpen: false,
  setWizardOpen: (wizardOpen) => set({ wizardOpen }),
  wizardPickMode: false,
  setWizardPickMode: (wizardPickMode) => set({ wizardPickMode }),
  timelineTick: null,
  setTimelineTick: (timelineTick) => set({ timelineTick }),
  notifications: [],
  pushNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) })),
}));

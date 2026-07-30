import type { WorldEvent, WorldEventType } from "@kawkab/shared-types";
import type { PlanetGrid } from "./grid.js";
import type { RngStream } from "./rng.js";
import type { WorldState } from "./types.js";

export interface EmitOptions {
  region?: number | null;
  actorIds?: string[];
  causeIds: string[];
  contributionId?: string | null;
  confidence?: number;
  magnitude?: number;
  title: string;
  summary: string;
  data?: WorldEvent["data"];
}

export type EmitFn = (type: WorldEventType, opts: EmitOptions) => WorldEvent;

/** Per-tick context handed to every simulation system. */
export interface SystemContext {
  grid: PlanetGrid;
  state: WorldState;
  rng: RngStream;
  yearsPerTick: number;
  emit: EmitFn;
  /** mark a cell as visually changed so it lands in the delta update */
  touch: (index: number) => void;
  /** causal locality: most recent event emitted for a cell */
  lastEventByCell: Map<number, string>;
  /** root genesis event ids, used as ultimate causes for geophysical drivers */
  genesisIds: { formed: string; oceans: string; life: string; plants: string };
  /** ids of recent global drivers (pollution spikes, eruptions, additions) */
  recentGlobalCauses: () => string[];
}

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

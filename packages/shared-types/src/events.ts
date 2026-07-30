import type { WorldEventType } from "./enums.js";
import type { GeoPoint } from "./world.js";

/**
 * A single fact in the world's history. Events are the atomic unit of the
 * event-sourced simulation: state can always be rebuilt by replaying them.
 *
 * Invariants enforced by the engine (and tested):
 *  - every non-genesis event has at least one entry in `causeIds`
 *  - `id` is a deterministic function of (seed, tick, sequence)
 */
export interface WorldEvent {
  id: string;
  tick: number;
  /** simulated years since planet formation */
  simYear: number;
  type: WorldEventType;
  title: string;
  summary: string;
  region: (GeoPoint & { index?: number }) | null;
  /** civ/species/city ids involved */
  actorIds: string[];
  /** ids of events that caused this one (causal graph edges) */
  causeIds: string[];
  /** the user contribution this event traces back to, if any */
  contributionId: string | null;
  /** engine confidence 0..1 (1 = purely deterministic consequence) */
  confidence: number;
  /** 0..1 how world-changing this is, drives UI importance */
  magnitude: number;
  /** machine-readable payload for renderers/narration */
  data: Record<string, number | string | boolean | null>;
}

export interface CausalNode {
  eventId: string;
  depth: number;
  children: CausalNode[];
}

export interface CausalChain {
  rootEventId: string;
  nodes: CausalNode;
  totalDescendants: number;
}

/** Compact fact used to ground AI narration — the narrator may ONLY use these. */
export interface NarrationFact {
  key: string;
  value: number | string;
  unit?: string;
  eventId?: string;
}

import type { WorldEventType } from "./enums.js";

/**
 * A single immutable world event. Events are the source of truth:
 * world state can always be rebuilt by replaying the event log
 * on top of a snapshot (Event Sourcing).
 */
export interface WorldEvent<TPayload = Record<string, unknown>> {
  /** Monotonic sequence number within the world. */
  seq: number;
  /** Simulation tick at which the event occurred. */
  tick: number;
  /** In-world year derived from the tick. */
  year: number;
  type: WorldEventType;
  /** Grid cell the event is anchored to, if any. */
  cellIndex?: number;
  /** Civilizations involved in the event. */
  civIds?: number[];
  /** Structured, JSON-serializable payload. */
  payload: TPayload;
  /** seq numbers of events that directly caused this one (causal graph edges). */
  causes: number[];
  /** 0..1 — how certain the engine is about downstream attribution. */
  confidence: number;
  /** The user contribution that ultimately originated this event, if any. */
  contributionId?: string;
  /** Importance 0..1 used for feed ranking and notifications. */
  importance: number;
  /** Hash chain: fnv1a(previousEventHash + stableStringify(event)). */
  hash: string;
}

export interface EventPage {
  events: WorldEvent[];
  nextCursor: number | null;
  total: number;
}

/** Delta message pushed over WebSocket; never a full world resend. */
export type RealtimeMessage =
  | { kind: "world.event"; worldId: string; event: WorldEvent }
  | { kind: "tick.completed"; worldId: string; tick: number; year: number; eventCount: number }
  | { kind: "notification"; userId: string; notification: NotificationPayload }
  | { kind: "contribution.status"; contributionId: string; status: string; detail?: string };

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  worldId: string;
  eventSeq?: number;
  createdAt: string;
}

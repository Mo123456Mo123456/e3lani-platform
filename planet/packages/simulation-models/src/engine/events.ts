import { WorldEventType, type WorldEvent } from "@planet/shared-types";
import { fnv1a, stableStringify } from "../hash.js";
import type { WorldState } from "./types.js";

const GENESIS_HASH = "genesis";

export interface EmitOptions {
  type: WorldEventType;
  cellIndex?: number;
  civIds?: number[];
  payload?: Record<string, unknown>;
  causes?: number[];
  confidence?: number;
  contributionId?: string;
  importance?: number;
}

/**
 * Append an immutable, hash-chained event to the world log.
 * Every state change flows through here — if nothing caused it,
 * it cannot happen (rule: no event without a cause).
 */
export function emitEvent(world: WorldState, opts: EmitOptions): WorldEvent {
  const prev = world.events.length > 0 ? world.events[world.events.length - 1] : undefined;
  const seq = (prev?.seq ?? 0) + 1;
  const base = {
    seq,
    tick: world.tick,
    year: world.tick * world.yearsPerTick,
    type: opts.type,
    cellIndex: opts.cellIndex,
    civIds: opts.civIds,
    payload: opts.payload ?? {},
    causes: opts.causes ?? [],
    confidence: opts.confidence ?? 1,
    contributionId: opts.contributionId,
    importance: opts.importance ?? 0.3,
  };
  const hash = fnv1a((prev?.hash ?? GENESIS_HASH) + stableStringify(base)).toString(16);
  const event: WorldEvent = { ...base, hash };
  world.events.push(event);
  return event;
}

/** Verify the integrity of the event hash chain (tamper detection). */
export function verifyEventChain(events: WorldEvent[]): boolean {
  let prevHash = GENESIS_HASH;
  for (const e of events) {
    const { hash, ...rest } = e;
    const expected = fnv1a(prevHash + stableStringify(rest)).toString(16);
    if (expected !== hash) return false;
    prevHash = hash;
  }
  return true;
}

/** Cursor-paginated query over the event log (newest first). */
export function queryEvents(
  events: WorldEvent[],
  opts: { beforeSeq?: number; limit?: number; types?: WorldEventType[]; contributionId?: string },
): { events: WorldEvent[]; nextCursor: number | null } {
  const limit = Math.min(opts.limit ?? 50, 500);
  const out: WorldEvent[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const e = events[i] as WorldEvent;
    if (opts.beforeSeq !== undefined && e.seq >= opts.beforeSeq) continue;
    if (opts.types && !opts.types.includes(e.type)) continue;
    if (opts.contributionId && e.contributionId !== opts.contributionId) continue;
    out.push(e);
  }
  const last = out[out.length - 1];
  return { events: out, nextCursor: out.length === limit && last ? last.seq : null };
}

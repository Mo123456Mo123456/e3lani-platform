import type { WorldEvent } from "@planet/shared-types";

/**
 * Causal graph over the event log. Edges are stored inside each event
 * (`causes: seq[]`); this module answers ancestry/descendancy queries,
 * e.g. "everything that happened because of contribution X".
 */
export function causalAncestors(events: WorldEvent[], seq: number, maxDepth = 32): number[] {
  const bySeq = new Map(events.map((e) => [e.seq, e]));
  const seen = new Set<number>();
  const queue: { s: number; d: number }[] = [{ s: seq, d: 0 }];
  while (queue.length > 0) {
    const { s, d } = queue.shift() as { s: number; d: number };
    if (d > maxDepth || seen.has(s)) continue;
    seen.add(s);
    const e = bySeq.get(s);
    if (!e) continue;
    for (const c of e.causes) queue.push({ s: c, d: d + 1 });
  }
  seen.delete(seq);
  return [...seen].sort((a, b) => a - b);
}

export function causalDescendants(events: WorldEvent[], seq: number, maxDepth = 32): number[] {
  const children = new Map<number, number[]>();
  for (const e of events) {
    for (const c of e.causes) {
      const list = children.get(c) ?? [];
      list.push(e.seq);
      children.set(c, list);
    }
  }
  const seen = new Set<number>();
  const queue: { s: number; d: number }[] = [{ s: seq, d: 0 }];
  while (queue.length > 0) {
    const { s, d } = queue.shift() as { s: number; d: number };
    if (d > maxDepth || seen.has(s)) continue;
    seen.add(s);
    for (const child of children.get(s) ?? []) queue.push({ s: child, d: d + 1 });
  }
  seen.delete(seq);
  return [...seen].sort((a, b) => a - b);
}

/** All events ultimately attributable to a contribution. */
export function contributionImpact(events: WorldEvent[], contributionId: string): WorldEvent[] {
  return events.filter((e) => e.contributionId === contributionId);
}

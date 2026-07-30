/**
 * Causal graph over the event journal.
 *
 * Events cite their direct causes (causeIds). Contribution-originated events
 * carry originContributionId, so the full downstream blast radius of a user
 * addition is traceable — and the AI narrator is only allowed to speak about
 * chains that exist in this graph.
 */
import type { CausalLink, WorldEvent } from "@planet/shared-types";

export interface CausalChain {
  rootId: string;
  events: WorldEvent[];
  links: CausalLink[];
  depth: number;
}

/** all events upstream of an event (why did it happen?) */
export function causalAncestors(journal: WorldEvent[], eventId: string, maxDepth = 12): CausalChain {
  const byId = new Map(journal.map((e) => [e.id, e]));
  const visited = new Map<string, number>();
  const links: CausalLink[] = [];
  let frontier: Array<{ id: string; depth: number }> = [{ id: eventId, depth: 0 }];
  let deepest = 0;
  while (frontier.length > 0) {
    const next: Array<{ id: string; depth: number }> = [];
    for (const { id, depth } of frontier) {
      if (visited.has(id) || depth > maxDepth) continue;
      visited.set(id, depth);
      deepest = Math.max(deepest, depth);
      const event = byId.get(id);
      if (!event) continue;
      for (const causeId of event.causeIds) {
        links.push({
          id: `cl-${causeId}-${id}`,
          planetId: event.planetId,
          fromId: causeId,
          toId: id,
          weight: event.confidence,
          mechanism: event.cause,
        });
        next.push({ id: causeId, depth: depth + 1 });
      }
    }
    frontier = next;
  }
  return {
    rootId: eventId,
    events: [...visited.keys()].map((id) => byId.get(id)!).filter(Boolean),
    links,
    depth: deepest,
  };
}

/** all events downstream of a contribution (what did it cause?) */
export function contributionDescendants(journal: WorldEvent[], contributionId: string): CausalChain {
  const direct = journal.filter((e) => e.originContributionId === contributionId);
  const byCause = new Map<string, WorldEvent[]>();
  for (const e of journal) {
    for (const causeId of e.causeIds) {
      const list = byCause.get(causeId);
      if (list) list.push(e);
      else byCause.set(causeId, [e]);
    }
  }
  const seen = new Map<string, number>();
  const links: CausalLink[] = [];
  let frontier: Array<{ id: string; depth: number }> = direct.map((e) => ({ id: e.id, depth: 0 }));
  let deepest = 0;
  const byId = new Map(journal.map((e) => [e.id, e]));
  while (frontier.length > 0) {
    const next: Array<{ id: string; depth: number }> = [];
    for (const { id, depth } of frontier) {
      if (seen.has(id) || depth > 14) continue;
      seen.set(id, depth);
      deepest = Math.max(deepest, depth);
      for (const child of byCause.get(id) ?? []) {
        links.push({
          id: `cl-${id}-${child.id}`,
          planetId: child.planetId,
          fromId: id,
          toId: child.id,
          weight: child.confidence,
          mechanism: child.cause,
        });
        next.push({ id: child.id, depth: depth + 1 });
      }
    }
    frontier = next;
  }
  return {
    rootId: contributionId,
    events: [...seen.keys()].map((id) => byId.get(id)!).filter(Boolean),
    links,
    depth: deepest,
  };
}

/**
 * Narration guard: returns only the claims (event ids + facts) the narrator
 * may mention for a contribution. Anything not in this list is off-limits.
 */
export function narrationAllowlist(
  journal: WorldEvent[],
  contributionId: string,
): { eventIds: Set<string>; facts: string[] } {
  const chain = contributionDescendants(journal, contributionId);
  const eventIds = new Set(chain.events.map((e) => e.id));
  const facts = chain.events.map((e) => `${e.type} @ tick ${e.tick}: ${e.cause}`);
  return { eventIds, facts };
}

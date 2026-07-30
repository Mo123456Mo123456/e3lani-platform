import type { CausalChain, CausalNode, WorldEvent } from "@kawkab/shared-types";

/**
 * The causal dependency graph: every event points at the events that caused
 * it. Supports forward traces ("what did this addition ultimately do?").
 */
export class CausalGraph {
  private readonly children = new Map<string, string[]>();
  private readonly byId = new Map<string, WorldEvent>();

  addEvent(event: WorldEvent): void {
    this.byId.set(event.id, event);
    for (const cause of event.causeIds) {
      const list = this.children.get(cause) ?? [];
      list.push(event.id);
      this.children.set(cause, list);
    }
  }

  get(id: string): WorldEvent | undefined {
    return this.byId.get(id);
  }

  descendantCount(rootId: string): number {
    const seen = new Set<string>();
    const stack = [rootId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const child of this.children.get(cur) ?? []) {
        if (!seen.has(child)) {
          seen.add(child);
          stack.push(child);
        }
      }
    }
    return seen.size;
  }

  chain(rootId: string, maxDepth = 4, maxNodes = 200): CausalChain {
    let count = 0;
    const build = (id: string, depth: number): CausalNode => {
      count++;
      const kids = depth < maxDepth && count < maxNodes ? (this.children.get(id) ?? []).map((c) => build(c, depth + 1)) : [];
      return { eventId: id, depth, children: kids };
    };
    const nodes = build(rootId, 0);
    return { rootEventId: rootId, nodes, totalDescendants: this.descendantCount(rootId) };
  }

  /** truncate history after a rollback */
  prune(keepIds: Set<string>): void {
    for (const id of [...this.byId.keys()]) if (!keepIds.has(id)) this.byId.delete(id);
    for (const [k, list] of [...this.children.entries()]) {
      const kept = list.filter((id) => keepIds.has(id));
      if (kept.length === 0 && !keepIds.has(k)) this.children.delete(k);
      else this.children.set(k, kept);
    }
  }
}

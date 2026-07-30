/**
 * Directed causal graph for world events and effects.
 */

export type CausalEdgeType = "causes" | "enables" | "amplifies" | "inhibits" | "triggers";

export interface CausalNode {
  id: string;
  label: string;
  kind: "event" | "effect" | "condition";
  tick?: number;
  meta?: Record<string, unknown>;
}

export interface CausalEdge {
  from: string;
  to: string;
  weight: number;
  type: CausalEdgeType;
}

export interface CausalPathExplanation {
  path: string[];
  totalWeight: number;
  steps: Array<{ from: string; to: string; type: CausalEdgeType; weight: number }>;
  narrative: string;
}

export class CausalGraph {
  private readonly nodes = new Map<string, CausalNode>();
  private readonly outEdges = new Map<string, CausalEdge[]>();
  private readonly inEdges = new Map<string, CausalEdge[]>();

  addNode(node: CausalNode): void {
    this.nodes.set(node.id, node);
    if (!this.outEdges.has(node.id)) this.outEdges.set(node.id, []);
    if (!this.inEdges.has(node.id)) this.inEdges.set(node.id, []);
  }

  addCause(
    fromId: string,
    toId: string,
    weight = 1,
    type: CausalEdgeType = "causes",
  ): void {
    if (!this.nodes.has(fromId)) {
      this.addNode({ id: fromId, label: fromId, kind: "event" });
    }
    if (!this.nodes.has(toId)) {
      this.addNode({ id: toId, label: toId, kind: "event" });
    }
    const edge: CausalEdge = { from: fromId, to: toId, weight, type };
    this.outEdges.get(fromId)!.push(edge);
    this.inEdges.get(toId)!.push(edge);
  }

  getNode(id: string): CausalNode | undefined {
    return this.nodes.get(id);
  }

  getDescendants(id: string): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of this.outEdges.get(cur) ?? []) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        result.push(e.to);
        stack.push(e.to);
      }
    }
    return result;
  }

  getAncestors(id: string): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of this.inEdges.get(cur) ?? []) {
        if (seen.has(e.from)) continue;
        seen.add(e.from);
        result.push(e.from);
        stack.push(e.from);
      }
    }
    return result;
  }

  topologicalSort(): string[] {
    const indeg = new Map<string, number>();
    for (const id of this.nodes.keys()) indeg.set(id, 0);
    for (const edges of this.outEdges.values()) {
      for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    }
    const queue: string[] = [];
    for (const [id, d] of indeg) {
      if (d === 0) queue.push(id);
    }
    const order: string[] = [];
    while (queue.length) {
      const n = queue.shift()!;
      order.push(n);
      for (const e of this.outEdges.get(n) ?? []) {
        const d = (indeg.get(e.to) ?? 1) - 1;
        indeg.set(e.to, d);
        if (d === 0) queue.push(e.to);
      }
    }
    return order;
  }

  /** Shortest weighted path explanation from source to target */
  explain(fromId: string, toId: string): CausalPathExplanation | null {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;
    if (fromId === toId) {
      return {
        path: [fromId],
        totalWeight: 0,
        steps: [],
        narrative: `${this.nodes.get(fromId)!.label} is the same node.`,
      };
    }

    // Dijkstra on inverted weights (higher weight = stronger cause = prefer)
    const dist = new Map<string, number>();
    const prev = new Map<string, { node: string; edge: CausalEdge }>();
    const pq: Array<{ id: string; cost: number }> = [{ id: fromId, cost: 0 }];
    dist.set(fromId, 0);

    while (pq.length) {
      pq.sort((a, b) => a.cost - b.cost);
      const { id, cost } = pq.shift()!;
      if (cost > (dist.get(id) ?? Infinity)) continue;
      if (id === toId) break;
      for (const e of this.outEdges.get(id) ?? []) {
        // convert strength to cost: stronger edges cheaper
        const stepCost = 1 / Math.max(0.01, e.weight);
        const next = cost + stepCost;
        if (next < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, next);
          prev.set(e.to, { node: id, edge: e });
          pq.push({ id: e.to, cost: next });
        }
      }
    }

    if (!prev.has(toId) && fromId !== toId) return null;

    const path: string[] = [];
    const steps: CausalPathExplanation["steps"] = [];
    let cur = toId;
    while (cur !== fromId) {
      path.unshift(cur);
      const p = prev.get(cur);
      if (!p) return null;
      steps.unshift({
        from: p.node,
        to: cur,
        type: p.edge.type,
        weight: p.edge.weight,
      });
      cur = p.node;
    }
    path.unshift(fromId);

    const labels = path.map((id) => this.nodes.get(id)?.label ?? id);
    const narrative = labels
      .map((l, i) => {
        if (i === 0) return l;
        const step = steps[i - 1]!;
        return `—[${step.type}:${step.weight.toFixed(2)}]→ ${l}`;
      })
      .join(" ");

    const totalWeight = steps.reduce((s, e) => s + e.weight, 0);
    return { path, totalWeight, steps, narrative };
  }

  edgeCount(): number {
    let n = 0;
    for (const e of this.outEdges.values()) n += e.length;
    return n;
  }

  nodeCount(): number {
    return this.nodes.size;
  }

  clear(): void {
    this.nodes.clear();
    this.outEdges.clear();
    this.inEdges.clear();
  }
}

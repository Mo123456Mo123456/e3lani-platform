export type CausalNode = {
  id: string;
  label: string;
  tick: number;
  kind: string;
  metrics?: Record<string, number>;
};

export type CausalEdge = {
  from: string;
  to: string;
  relation: "caused" | "amplified" | "mitigated" | "enabled" | "blocked" | "correlated";
  strength: number;
  delayTicks: number;
};

/**
 * Causal dependency graph for tracing contribution → effects.
 */
export class CausalGraph {
  nodes = new Map<string, CausalNode>();
  edges: CausalEdge[] = [];

  addNode(node: CausalNode): void {
    this.nodes.set(node.id, node);
  }

  link(
    from: string,
    to: string,
    relation: CausalEdge["relation"],
    strength: number,
    delayTicks = 0,
  ): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return;
    this.edges.push({ from, to, relation, strength, delayTicks });
  }

  /** BFS forward effects from a root node */
  effectsFrom(rootId: string, maxDepth = 6): CausalNode[] {
    const seen = new Set<string>();
    const out: CausalNode[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];
    while (queue.length) {
      const { id, depth } = queue.shift()!;
      if (seen.has(id) || depth > maxDepth) continue;
      seen.add(id);
      const node = this.nodes.get(id);
      if (node && id !== rootId) out.push(node);
      for (const e of this.edges) {
        if (e.from === id) queue.push({ id: e.to, depth: depth + 1 });
      }
    }
    return out;
  }

  /** Walk backward for root causes */
  causesOf(nodeId: string, maxDepth = 6): CausalNode[] {
    const seen = new Set<string>();
    const out: CausalNode[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
    while (queue.length) {
      const { id, depth } = queue.shift()!;
      if (seen.has(id) || depth > maxDepth) continue;
      seen.add(id);
      const node = this.nodes.get(id);
      if (node && id !== nodeId) out.push(node);
      for (const e of this.edges) {
        if (e.to === id) queue.push({ id: e.from, depth: depth + 1 });
      }
    }
    return out;
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
  }

  static fromJSON(data: { nodes: CausalNode[]; edges: CausalEdge[] }): CausalGraph {
    const g = new CausalGraph();
    for (const n of data.nodes) g.addNode(n);
    g.edges = [...data.edges];
    return g;
  }
}

import type { CausalEdge, CausalGraph, CausalNode, SimulationEffect } from "@planet/shared-types";
import { hashString } from "./rng.js";

export function buildCausalGraph(
  rootLabel: string,
  effects: SimulationEffect[],
  horizons: number[] = [1, 10, 100],
): CausalGraph {
  const nodes: CausalNode[] = [
    {
      id: "root",
      label: rootLabel,
      kind: "cause",
      magnitude: 1,
      tickOffset: 0,
    },
  ];
  const edges: CausalEdge[] = [];

  effects.forEach((effect, idx) => {
    const directId = `direct_${idx}`;
    nodes.push({
      id: directId,
      label: `${effect.domain}:${effect.metric}`,
      kind: "direct",
      magnitude: effect.delta,
      tickOffset: 1,
    });
    edges.push({
      from: "root",
      to: directId,
      relation: "causes",
      strength: Math.min(1, Math.abs(effect.delta) + 0.2),
    });

    const secondaryId = `secondary_${idx}`;
    nodes.push({
      id: secondaryId,
      label: `secondary_${effect.domain}`,
      kind: "secondary",
      magnitude: effect.delta * 0.55,
      tickOffset: horizons[1] ?? 10,
    });
    edges.push({
      from: directId,
      to: secondaryId,
      relation: "propagates",
      strength: 0.55,
    });

    const longId = `long_${idx}`;
    nodes.push({
      id: longId,
      label: `long_term_${effect.metric}`,
      kind: "long_term",
      magnitude: effect.delta * 0.3,
      tickOffset: horizons[2] ?? 100,
    });
    edges.push({
      from: secondaryId,
      to: longId,
      relation: "evolves_into",
      strength: 0.35,
    });
  });

  return { nodes, edges };
}

export function effectsFingerprint(effects: SimulationEffect[]): string {
  return hashString(
    effects
      .map((e) => `${e.domain}:${e.metric}:${e.delta.toFixed(4)}`)
      .sort()
      .join("|"),
  ).toString(16);
}

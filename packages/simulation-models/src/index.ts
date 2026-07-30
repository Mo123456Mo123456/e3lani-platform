export interface PopulationInputs {
  population: number;
  carryingCapacity: number;
  intrinsicGrowthRate: number;
  foodSecurity: number;
  diseasePressure: number;
  conflictPressure: number;
}

export function logisticPopulationStep(inputs: PopulationInputs): number {
  if (inputs.population <= 0 || inputs.carryingCapacity <= 0) return 0;
  const capacityRatio = inputs.population / inputs.carryingCapacity;
  const environmentalFactor = Math.max(
    -1,
    Math.min(1, inputs.foodSecurity - inputs.diseasePressure * 0.7 - inputs.conflictPressure * 0.9),
  );
  const growth =
    inputs.intrinsicGrowthRate *
    inputs.population *
    (1 - capacityRatio) *
    environmentalFactor;
  return Math.max(0, Math.min(inputs.carryingCapacity, Math.round(inputs.population + growth)));
}

export interface PredatorPreyInputs {
  prey: number;
  predators: number;
  preyGrowth: number;
  predationRate: number;
  predatorEfficiency: number;
  predatorMortality: number;
  preyCapacity: number;
}

export function predatorPreyStep(inputs: PredatorPreyInputs): { prey: number; predators: number } {
  const preyGrowth =
    inputs.preyGrowth * inputs.prey * (1 - inputs.prey / Math.max(1, inputs.preyCapacity));
  const consumed = Math.min(inputs.prey, inputs.predationRate * inputs.prey * inputs.predators);
  const predatorGrowth = inputs.predatorEfficiency * consumed;
  return {
    prey: Math.max(0, Math.round(inputs.prey + preyGrowth - consumed)),
    predators: Math.max(0, Math.round(inputs.predators + predatorGrowth - inputs.predatorMortality * inputs.predators)),
  };
}

export interface ClimateCell {
  temperature: number;
  moisture: number;
  vegetation: number;
  pollution: number;
  volcanicActivity: number;
}

export function climateStep(cell: ClimateCell, neighbors: ClimateCell[], emissions: number): ClimateCell {
  const neighborhood = neighbors.length === 0 ? cell : neighbors.reduce(
    (sum, neighbor) => ({
      temperature: sum.temperature + neighbor.temperature / neighbors.length,
      moisture: sum.moisture + neighbor.moisture / neighbors.length,
      vegetation: sum.vegetation + neighbor.vegetation / neighbors.length,
      pollution: sum.pollution + neighbor.pollution / neighbors.length,
      volcanicActivity: sum.volcanicActivity + neighbor.volcanicActivity / neighbors.length,
    }),
    { temperature: 0, moisture: 0, vegetation: 0, pollution: 0, volcanicActivity: 0 },
  );
  const pollution = Math.max(0, cell.pollution * 0.91 + neighborhood.pollution * 0.06 + emissions);
  const vegetation = Math.max(0, Math.min(1, cell.vegetation + cell.moisture * 0.012 - pollution * 0.007));
  return {
    temperature: Math.max(
      0,
      Math.min(1, cell.temperature * 0.92 + neighborhood.temperature * 0.07 + pollution * 0.003 + cell.volcanicActivity * 0.004),
    ),
    moisture: Math.max(0, Math.min(1, cell.moisture * 0.9 + neighborhood.moisture * 0.09 + vegetation * 0.005)),
    vegetation,
    pollution,
    volcanicActivity: Math.max(0, cell.volcanicActivity * 0.82),
  };
}

export interface WeightedEdge {
  from: string;
  to: string;
  distance: number;
  risk: number;
  blocked?: boolean;
}

export function shortestSafePath(
  origin: string,
  destination: string,
  edges: WeightedEdge[],
): { path: string[]; cost: number } | null {
  const nodes = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const distances = new Map<string, number>([...nodes].map((node) => [node, Number.POSITIVE_INFINITY]));
  const previous = new Map<string, string>();
  const unvisited = new Set(nodes);
  distances.set(origin, 0);

  while (unvisited.size > 0) {
    let current: string | undefined;
    let smallest = Number.POSITIVE_INFINITY;
    for (const node of unvisited) {
      const distance = distances.get(node) ?? Number.POSITIVE_INFINITY;
      if (distance < smallest) {
        smallest = distance;
        current = node;
      }
    }
    if (!current || smallest === Number.POSITIVE_INFINITY) break;
    if (current === destination) break;
    unvisited.delete(current);

    for (const edge of edges) {
      if (edge.blocked || (edge.from !== current && edge.to !== current)) continue;
      const neighbor = edge.from === current ? edge.to : edge.from;
      if (!unvisited.has(neighbor)) continue;
      const cost = edge.distance * (1 + Math.max(0, edge.risk));
      const candidate = smallest + cost;
      if (candidate < (distances.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor, candidate);
        previous.set(neighbor, current);
      }
    }
  }

  const cost = distances.get(destination) ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(cost)) return null;
  const path = [destination];
  while (path[0] !== origin) {
    const prior = previous.get(path[0] as string);
    if (!prior) return null;
    path.unshift(prior);
  }
  return { path, cost };
}

import type {
  ContributionTraits,
  ParsedContribution,
  PlantTraits,
  ResourceKind,
  SpeciesTraits,
  SuitabilityCell,
  WorldEvent,
} from "@kawkab/shared-types";
import { clamp, clamp01, type SystemContext } from "../context.js";
import { deterministicId } from "../rng.js";
import type { CivStateInternal, PendingContribution, PhenomenonState } from "../types.js";

/**
 * Injects a balanced, validated user contribution into the living world.
 * The ELEMENT_ADDED event is the causal root for everything that follows.
 */
export function applyContribution(ctx: SystemContext, pending: PendingContribution): WorldEvent {
  const { state, grid, emit } = ctx;
  const { parsed } = pending;
  const origin = state.cells[pending.originIndex] ?? state.cells[0]!;

  const root = emit("ELEMENT_ADDED", {
    region: pending.originIndex,
    actorIds: [pending.userId],
    causeIds: [], // root: the user's act of creation
    contributionId: pending.id,
    confidence: 1,
    magnitude: 0.6,
    title: `${parsed.name} enters the world`,
    summary: parsed.description || `A new ${parsed.category} appeared: ${parsed.name}.`,
    data: { category: parsed.category, contributionId: pending.id },
  });

  switch (parsed.category) {
    case "plant": {
      const traits: PlantTraits = {
        size: parsed.traits.size ?? 0.5,
        growthRate: parsed.traits.growthRate ?? 0.4,
        waterNeed: parsed.traits.waterNeed ?? 0.5,
        heatResistance: parsed.traits.heatResistance ?? 0.5,
        coldResistance: parsed.traits.coldResistance ?? 0.5,
        pollutionAbsorption: parsed.traits.pollutionAbsorption ?? 0.2,
        energyStorage: parsed.traits.energyStorage ?? 0.3,
        luminosity: parsed.traits.luminosity ?? 0,
        toxicity: parsed.traits.toxicity ?? 0,
        spreadRate: parsed.traits.spreadRate ?? 0.4,
      };
      const id = deterministicId("pl", state.seed, state.tick, pending.id);
      const cells = new Set<number>();
      let seedCells = [pending.originIndex, ...grid.neighbors(pending.originIndex)]
        .filter((idx) => !state.cells[idx]!.isOcean)
        .slice(0, 4);
      if (seedCells.length === 0) {
        const land = nearestLandCell(ctx, pending.originIndex);
        if (land >= 0) seedCells = [land, ...grid.neighbors(land).filter((idx) => !state.cells[idx]!.isOcean).slice(0, 2)];
      }
      for (const idx of seedCells) {
        cells.add(idx);
        state.cells[idx]!.plantCoverage = clamp01(state.cells[idx]!.plantCoverage + 0.1);
        ctx.touch(idx);
      }
      state.plants.set(id, {
        id,
        name: parsed.name,
        originContributionId: pending.id,
        biomes: parsed.possibleBiomes.length > 0 ? parsed.possibleBiomes : [origin.biome],
        traits,
        createdTick: state.tick,
        createdEventId: root.id,
        extinct: false,
        cells,
        estimatedCoverage: cells.size,
      });
      break;
    }
    case "creature": {
      const t = parsed.traits;
      const traits: SpeciesTraits = {
        size: t.size ?? 0.4,
        lifespan: t.lifespan ?? 0.5,
        reproductionRate: t.reproductionRate ?? 0.4,
        heatResistance: t.heatResistance ?? 0.5,
        coldResistance: t.coldResistance ?? 0.5,
        waterNeed: t.waterNeed ?? 0.5,
        intelligence: t.intelligence ?? 0.3,
        aggression: t.aggression ?? 0.3,
        mobility: t.mobility ?? 0.5,
        adaptability: t.adaptability ?? 0.5,
        mutationRate: clamp01(t.mutationRate ?? 0.15),
      };
      const id = deterministicId("sp", state.seed, state.tick, pending.id);
      state.species.set(id, {
        id,
        name: parsed.name,
        parentId: null,
        originContributionId: pending.id,
        homeBiome: origin.isOcean ? "ocean" : origin.biome,
        traits,
        diet: (t.aggression ?? 0.3) > 0.6 ? "meat" : "plants",
        preyIds: [],
        createdTick: state.tick,
        createdEventId: root.id,
        extinct: false,
        extinctTick: null,
      });
      const pops = new Map<number, number>();
      pops.set(pending.originIndex, 120);
      for (const nb of grid.neighbors(pending.originIndex).slice(0, 2)) {
        if (state.cells[nb]!.isOcean === origin.isOcean) pops.set(nb, 60);
      }
      state.speciesPops.set(id, pops);
      const ev = emit("SPECIES_CREATED", {
        region: pending.originIndex,
        causeIds: [root.id],
        contributionId: pending.id,
        magnitude: 0.5,
        title: `${parsed.name} appears`,
        summary: `${parsed.name} took its first breath in ${origin.isOcean ? "the ocean" : `the ${origin.biome}`}.`,
        data: { speciesId: id },
      });
      const sp = state.species.get(id)!;
      sp.createdEventId = ev.id;
      break;
    }
    case "resource": {
      const kind = pickResourceKind(parsed.traits, origin.biome);
      const cells = [pending.originIndex, ...grid.neighbors(pending.originIndex)].slice(0, 4);
      for (const idx of cells) {
        const cell = state.cells[idx]!;
        cell.resources.push({
          kind,
          amount: clamp01(0.4 + (parsed.traits.scarcity !== undefined ? 1 - parsed.traits.scarcity : 0.3) * 0.5),
          renewalRate: clamp01(parsed.traits.renewalRate ?? 0),
          discovered: false,
        });
        ctx.touch(idx);
      }
      emit("RESOURCE_DISCOVERED", {
        region: pending.originIndex,
        causeIds: [root.id],
        contributionId: pending.id,
        magnitude: 0.45,
        title: `${parsed.name} deposit`,
        summary: `Deposits of ${parsed.name} (${kind}) now lie in this region.`,
        data: { kind, cells: cells.length },
      });
      break;
    }
    case "civilization": {
      if (origin.isOcean) break;
      const id = deterministicId("cv", state.seed, state.tick, pending.id);
      const cityId = deterministicId("ct", state.seed, state.tick, pending.id, "capital");
      const t = parsed.traits;
      const civ: CivStateInternal = {
        id,
        name: parsed.name,
        color: `hsl(${Math.floor((t.influence ?? 0.5) * 60 + 20)}, 70%, 55%)`,
        foundedTick: state.tick,
        population: 600,
        territory: new Set([pending.originIndex]),
        cityIds: [cityId],
        capitalCityId: cityId,
        techKeys: new Set(["fire", "stone_tools", "weaving"]),
        techEra: "stone",
        government: "tribe",
        military: clamp01(t.aggression ?? 0.3),
        stability: 0.6,
        happiness: 0.6,
        health: 0.6,
        education: clamp01(t.intelligence ?? 0.2),
        economy: 0.3,
        foodSecurity: 0.8,
        aggression: clamp01(t.aggression ?? 0.4),
        innovation: clamp01(t.intelligence ?? 0.5),
        pollutionPerCapita: 0.02,
        stockpiles: { grain: 0.6 },
        relations: {},
        memory: [root.id],
        researchProgress: 0,
        actionCooldowns: {},
        extinct: false,
        cultureName: `${parsed.name} culture`,
        languageName: `${parsed.name}i`,
        languageFamily: `family-user-${pending.id.slice(-4)}`,
      };
      origin.ownerCivId = id;
      origin.cityId = cityId;
      origin.population = 600;
      state.civs.set(id, civ);
      state.cities.set(cityId, {
        id: cityId,
        name: `${parsed.name} City`,
        civId: id,
        cellIndex: pending.originIndex,
        population: 600,
        foundedTick: state.tick,
        isCapital: true,
        health: 0.6,
        prosperity: 0.4,
      });
      for (const other of state.civs.values()) {
        if (other.id === id) continue;
        other.relations[id] = 0;
        civ.relations[other.id] = 0;
      }
      ctx.touch(pending.originIndex);
      emit("CIVILIZATION_FOUNDED", {
        region: pending.originIndex,
        actorIds: [id],
        causeIds: [root.id],
        contributionId: pending.id,
        magnitude: 0.65,
        title: `${parsed.name} founded`,
        summary: `A new people, ${parsed.name}, raised their first settlement.`,
        data: { civId: id },
      });
      break;
    }
    case "invention": {
      const key = `user_${pending.id.slice(-8)}`;
      state.techTree.push({
        key,
        name: parsed.name,
        era: "industrial",
        prereqKeys: [],
        cost: 0.1,
        effects: { science: clamp01(parsed.traits.intelligence ?? 0.3) * 0.2, energy: clamp01(parsed.traits.energyOutput ?? 0) * 0.25, industry: clamp01(parsed.traits.value ?? 0.2) * 0.15 },
      });
      // nearest civ adopts it first
      let adopter: CivStateInternal | null = null;
      let bestDist = Infinity;
      for (const civ of state.civs.values()) {
        if (civ.extinct) continue;
        const cap = state.cities.get(civ.capitalCityId ?? "")?.cellIndex;
        if (cap === undefined) continue;
        const d = grid.distance(cap, pending.originIndex);
        if (d < bestDist) {
          bestDist = d;
          adopter = civ;
        }
      }
      if (adopter) {
        adopter.techKeys.add(key);
        adopter.memory.push(root.id);
        emit("TECHNOLOGY_DISCOVERED", {
          region: pending.originIndex,
          actorIds: [adopter.id],
          causeIds: [root.id],
          contributionId: pending.id,
          magnitude: 0.55,
          title: `${adopter.name} harnesses ${parsed.name}`,
          summary: `${parsed.name} spread to the workshops of ${adopter.name}.`,
          data: { tech: key, civId: adopter.id },
        });
      }
      break;
    }
    case "natural_phenomenon": {
      const phenomenon: PhenomenonState = {
        id: deterministicId("ph", state.seed, state.tick, pending.id),
        contributionId: pending.id,
        centerIndex: pending.originIndex,
        radius: 3,
        moistureDelta: clamp((parsed.traits.waterNeed ?? 0.3) * 0.6 - 0.1, -0.4, 0.4),
        tempDelta: clamp((parsed.traits.heatResistance ?? 0.5) * 8 - 4, -6, 6),
        stormBoost: clamp01(parsed.traits.energyOutput ?? 0) * 0.3,
        strength: 1,
        eventId: root.id,
      };
      state.phenomena.push(phenomenon);
      emit("CLIMATE_CHANGED", {
        region: pending.originIndex,
        causeIds: [root.id],
        contributionId: pending.id,
        magnitude: 0.55,
        title: `${parsed.name} manifests`,
        summary: `A lasting phenomenon now shapes the climate around this region.`,
        data: { moistureDelta: phenomenon.moistureDelta, tempDelta: phenomenon.tempDelta },
      });
      break;
    }
    case "disease": {
      const id = deterministicId("ds", state.seed, state.tick, pending.id);
      state.diseases.set(id, {
        id,
        name: parsed.name,
        originContributionId: pending.id,
        severity: clamp01(parsed.traits.lethality ?? 0.3),
        contagiousness: clamp01(parsed.traits.contagiousness ?? 0.4),
        affectedCivIds: new Set(origin.ownerCivId ? [origin.ownerCivId] : []),
        startedTick: state.tick,
        contained: false,
        cells: new Set([pending.originIndex]),
      });
      emit("DISEASE_OUTBREAK", {
        region: pending.originIndex,
        causeIds: [root.id],
        contributionId: pending.id,
        magnitude: 0.6,
        title: `${parsed.name} emerges`,
        summary: `${parsed.name} began spreading from this region.`,
        data: { diseaseId: id },
      });
      break;
    }
    case "culture": {
      let touched = 0;
      for (const civ of state.civs.values()) {
        if (civ.extinct) continue;
        const cap = state.cities.get(civ.capitalCityId ?? "")?.cellIndex;
        if (cap === undefined || grid.distance(cap, pending.originIndex) > 12) continue;
        civ.happiness = clamp01(civ.happiness + 0.1 * (parsed.traits.influence ?? 0.5));
        civ.education = clamp01(civ.education + 0.05 * (parsed.traits.intelligence ?? 0.4));
        civ.memory.push(root.id);
        touched++;
      }
      emit("CULTURE_EMERGED", {
        region: pending.originIndex,
        causeIds: [root.id],
        contributionId: pending.id,
        magnitude: 0.45,
        title: `${parsed.name} inspires`,
        summary: `The ideas of ${parsed.name} spread among ${touched} civilizations.`,
        data: { civsTouched: touched },
      });
      break;
    }
    case "world_law": {
      const t = parsed.traits;
      if (t.warProbabilityMultiplier !== undefined) {
        state.laws.warProbabilityMultiplier = clamp(t.warProbabilityMultiplier, 0.2, 3);
      }
      if (t.climateSensitivityMultiplier !== undefined) {
        state.laws.climateSensitivityMultiplier = clamp(t.climateSensitivityMultiplier, 0.2, 3);
      }
      break;
    }
    case "custom": {
      // map onto the closest governed category by dominant traits
      const t = parsed.traits;
      const remapped: PendingContribution = {
        ...pending,
        parsed: {
          ...parsed,
          category:
            (t.pollutionAbsorption ?? 0) > 0.3 || (t.growthRate ?? 0) > 0.5
              ? "plant"
              : (t.aggression ?? 0) > 0.4 || (t.mobility ?? 0) > 0.6
                ? "creature"
                : "natural_phenomenon",
        },
      };
      applyContribution(ctx, remapped);
      break;
    }
  }
  return root;
}

/** expanding ring search for the closest land cell (deterministic) */
function nearestLandCell(ctx: Pick<SystemContext, "state" | "grid">, from: number): number {
  const { state, grid } = ctx;
  if (!state.cells[from]!.isOcean) return from;
  const seen = new Set<number>([from]);
  let frontier = grid.neighbors(from);
  for (let depth = 0; depth < 12 && frontier.length > 0; depth++) {
    frontier.sort((a, b) => grid.distance(a, from) - grid.distance(b, from));
    const next: number[] = [];
    for (const idx of frontier) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      if (!state.cells[idx]!.isOcean) return idx;
      next.push(...grid.neighbors(idx));
    }
    frontier = next;
  }
  return -1;
}

function pickResourceKind(traits: ContributionTraits, biome: string): ResourceKind {
  if ((traits.energyOutput ?? 0) > 0.6) return biome === "volcanic" ? "geothermal" : "solar";
  if ((traits.value ?? 0) > 0.7) return biome === "volcanic" ? "crystal" : "gold";
  switch (biome) {
    case "mountains": return "iron";
    case "desert": return "oil";
    case "tundra": return "uranium";
    case "rainforest":
    case "temperate_forest": return "timber";
    case "swamp": return "coal";
    default: return "crystal";
  }
}

/** rank the best origin cells for a parsed contribution (for the preview step) */
export function suggestOrigins(ctx: Pick<SystemContext, "state" | "grid">, parsed: ParsedContribution, limit = 8): SuitabilityCell[] {
  const { state, grid } = ctx;
  const out: SuitabilityCell[] = [];
  for (const cell of state.cells) {
    let score = 0;
    switch (parsed.category) {
      case "plant": {
        if (cell.isOcean) break;
        const biomeFit = parsed.possibleBiomes.length === 0 || parsed.possibleBiomes.includes(cell.biome) ? 0.6 : 0.1;
        const waterFit = clamp01(1.2 - (parsed.traits.waterNeed ?? 0.5) * (1 - cell.moisture));
        score = biomeFit + waterFit * 0.3 + cell.fertility * 0.1;
        break;
      }
      case "creature": {
        const biomeFit = parsed.possibleBiomes.length === 0 || parsed.possibleBiomes.includes(cell.biome) ? 0.6 : cell.isOcean ? 0.2 : 0.1;
        score = biomeFit + cell.plantCoverage * 0.3 + (cell.isOcean ? 0.1 : 0);
        break;
      }
      case "civilization": {
        if (cell.isOcean || cell.ownerCivId) break;
        const coastal = grid.neighbors(cell.index).some((n) => state.cells[n]!.isOcean) ? 0.2 : 0;
        score = cell.fertility * 0.6 + cell.river * 0.2 + coastal;
        break;
      }
      case "resource": {
        if (cell.isOcean) break;
        score = (cell.biome === "mountains" || cell.biome === "volcanic" ? 0.6 : 0.3) + cell.resources.length * 0.05;
        break;
      }
      case "disease":
      case "culture":
      case "invention": {
        score = cell.population > 100 ? 0.5 + Math.min(0.4, cell.population / 5000) : 0.05;
        break;
      }
      default: {
        score = cell.isOcean ? 0.2 : 0.4 + cell.moisture * 0.2;
      }
    }
    if (score > 0.25) out.push({ index: cell.index, lat: grid.lat(cell.index), lon: grid.lon(cell.index), score });
  }
  out.sort((a, b) => b.score - a.score);
  // de-cluster: keep the best cell per broad area
  const picked: SuitabilityCell[] = [];
  for (const c of out) {
    if (picked.every((p) => grid.distance(p.index, c.index) > 6)) picked.push(c);
    if (picked.length >= limit) break;
  }
  return picked;
}

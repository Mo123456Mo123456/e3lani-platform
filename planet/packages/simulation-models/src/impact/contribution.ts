import {
  BiomeType,
  ContributionCategory,
  WorldEventType,
  type AnalyzedContribution,
  type WorldEvent,
} from "@planet/shared-types";
import { clamp01 } from "../math.js";
import { BIOME_ORDER, type ResourceDeposit } from "../planet/types.js";
import { habitability } from "../planet/biomes.js";
import { emitEvent } from "../engine/events.js";
import { nextId, speciesPopulation, type Civilization, type Species, type WorldState } from "../engine/types.js";
import { civName, cultureName, languageName, religionName, speciesName } from "../engine/names.js";
import { GovernmentType } from "@planet/shared-types";
import { random } from "../rng.js";
import { habitatSuitability } from "../engine/systems/ecology.js";

export interface ApplyResult {
  ok: boolean;
  reason?: string;
  rootEvent?: WorldEvent;
  entityId?: number;
}

/**
 * Apply a validated, balanced user contribution to the world. The element
 * becomes a real entity (species, deposit, civ, disease, law…) and the
 * causal root event is registered so every downstream consequence can be
 * traced back to this user.
 */
export function applyContribution(
  world: WorldState,
  contributionId: string,
  analysis: AnalyzedContribution,
  cellIndex: number,
): ApplyResult {
  if (cellIndex < 0 || cellIndex >= world.grid.cellCount) {
    return { ok: false, reason: "cell_out_of_bounds" };
  }
  const t = analysis.traits;
  const biome = BIOME_ORDER[world.grid.biome[cellIndex] ?? 0] ?? BiomeType.Ocean;

  switch (analysis.category) {
    case ContributionCategory.Plant: {
      if (biome === BiomeType.Ocean) return { ok: false, reason: "plants_need_land" };
      const species = makeSpeciesFromTraits(world, analysis, "flora", contributionId);
      const suit = habitatSuitability(world, species, cellIndex);
      if (suit < 0.1) return { ok: false, reason: "unsuitable_habitat" };
      species.cells[String(cellIndex)] = 40;
      world.species.push(species);
      const ev = emitEvent(world, {
        type: WorldEventType.ContributionApplied,
        cellIndex,
        payload: { category: analysis.category, name: analysis.name, speciesId: species.id },
        contributionId,
        importance: 0.7,
      });
      world.contributionRoots[contributionId] = ev.seq;
      emitEvent(world, {
        type: WorldEventType.SpeciesCreated,
        cellIndex,
        payload: { speciesId: species.id, name: species.name, kind: "flora" },
        causes: [ev.seq],
        contributionId,
        importance: 0.6,
      });
      return { ok: true, rootEvent: ev, entityId: species.id };
    }

    case ContributionCategory.Creature: {
      if (biome === BiomeType.Ocean && t.size < 0.3) return { ok: false, reason: "unsuitable_habitat" };
      const species = makeSpeciesFromTraits(world, analysis, "fauna", contributionId);
      species.cells[String(cellIndex)] = 25;
      // Wire into the local food web.
      for (const other of world.species) {
        if (other.extinct) continue;
        if (other.kind === "flora" && species.diet !== "carnivore" && other.cells[String(cellIndex)]) {
          species.prey.push(other.id);
          other.predators.push(species.id);
        } else if (other.kind === "fauna" && other.size < species.size && species.diet !== "herbivore" && other.cells[String(cellIndex)]) {
          species.prey.push(other.id);
          other.predators.push(species.id);
        }
        if (species.prey.length >= 3) break;
      }
      world.species.push(species);
      const ev = emitEvent(world, {
        type: WorldEventType.ContributionApplied,
        cellIndex,
        payload: { category: analysis.category, name: analysis.name, speciesId: species.id },
        contributionId,
        importance: 0.7,
      });
      world.contributionRoots[contributionId] = ev.seq;
      emitEvent(world, {
        type: WorldEventType.SpeciesCreated,
        cellIndex,
        payload: { speciesId: species.id, name: species.name, kind: "fauna", diet: species.diet },
        causes: [ev.seq],
        contributionId,
        importance: 0.6,
      });
      return { ok: true, rootEvent: ev, entityId: species.id };
    }

    case ContributionCategory.Resource: {
      const kind = t.energyOutput > 0.6 ? "energy_source" : t.rarity > 0.7 ? "rare_earth" : t.toxicity > 0.4 ? "metal_ore" : "gem";
      const deposit: ResourceDeposit = {
        id: nextId(world, "deposit"),
        cell: cellIndex,
        kind: kind as ResourceDeposit["kind"],
        quantity: 800 + t.size * 1200,
        regenRate: t.growthRate * 0.01,
        extractionRate: 0.01 + t.rarity * 0.02,
        value: 1 + t.rarity * 2 + t.energyOutput,
        depleted: false,
      };
      world.deposits.push(deposit);
      const ev = emitEvent(world, {
        type: WorldEventType.ContributionApplied,
        cellIndex,
        payload: { category: analysis.category, name: analysis.name, depositId: deposit.id, kind },
        contributionId,
        importance: 0.65,
      });
      world.contributionRoots[contributionId] = ev.seq;
      return { ok: true, rootEvent: ev, entityId: deposit.id };
    }

    case ContributionCategory.Civilization: {
      if (habitability(biome) < 0.3) return { ok: false, reason: "uninhabitable_for_civilization" };
      if (world.civs.some((c) => !c.fallen && c.cells.includes(cellIndex))) {
        return { ok: false, reason: "territory_occupied" };
      }
      const civ: Civilization = {
        id: nextId(world, "civ"),
        name: analysis.name || civName(world.rng, "contribution"),
        population: 600 + t.size * 2000,
        cells: [cellIndex],
        capitalCell: cellIndex,
        techLevel: Math.floor(t.intelligence * 6),
        government: GovernmentType.Tribe,
        military: 0.1 + t.aggression * 0.3,
        economy: 0.15,
        stability: 0.6,
        happiness: 0.6,
        education: t.intelligence * 0.5,
        health: 0.5,
        pollutionOutput: 0.02 + t.pollutionEmission * 0.05,
        foodSecurity: 0.6,
        aggression: t.aggression,
        expansionism: t.spreadRate,
        curiosity: t.intelligence,
        culture: cultureName(world.rng, "contribution"),
        language: languageName(world.rng, "contribution"),
        religion: religionName(world.rng, "contribution"),
        stockpiles: { food: 400 },
        fallen: false,
        foundedTick: world.tick,
        memory: { grievances: [], pastAllies: [], notableEvents: [] },
        contributionId,
      };
      world.civs.push(civ);
      const ev = emitEvent(world, {
        type: WorldEventType.ContributionApplied,
        cellIndex,
        payload: { category: analysis.category, name: analysis.name, civId: civ.id },
        contributionId,
        importance: 0.8,
      });
      world.contributionRoots[contributionId] = ev.seq;
      emitEvent(world, {
        type: WorldEventType.CivilizationFounded,
        cellIndex,
        civIds: [civ.id],
        payload: { name: civ.name },
        causes: [ev.seq],
        contributionId,
        importance: 0.75,
      });
      return { ok: true, rootEvent: ev, entityId: civ.id };
    }

    case ContributionCategory.Invention: {
      const holder = nearestCiv(world, cellIndex);
      const tech = {
        id: nextId(world, "tech"),
        name: analysis.name,
        tier: holder ? Math.min(holder.techLevel + 1, 49) : 1,
        discoveredBy: holder?.id,
        discoveredTick: world.tick,
        contributionId,
      };
      world.techs.push(tech);
      if (holder) {
        holder.techLevel = Math.max(holder.techLevel, tech.tier);
        holder.education = clamp01(holder.education + 0.05);
      }
      const ev = emitEvent(world, {
        type: WorldEventType.ContributionApplied,
        cellIndex,
        civIds: holder ? [holder.id] : [],
        payload: { category: analysis.category, name: tech.name, techId: tech.id },
        contributionId,
        importance: 0.7,
      });
      world.contributionRoots[contributionId] = ev.seq;
      emitEvent(world, {
        type: WorldEventType.TechnologyDiscovered,
        civIds: holder ? [holder.id] : [],
        payload: { name: tech.name, tier: tech.tier },
        causes: [ev.seq],
        contributionId,
        importance: 0.6,
      });
      return { ok: true, rootEvent: ev, entityId: tech.id };
    }

    case ContributionCategory.Disease: {
      const disease = {
        id: nextId(world, "disease"),
        name: analysis.name,
        virulence: 0.2 + t.spreadRate * 0.6,
        lethality: 0.02 + t.toxicity * 0.2,
        cells: [cellIndex],
        startedTick: world.tick,
        active: true,
        contributionId,
      };
      world.diseases.push(disease);
      const ev = emitEvent(world, {
        type: WorldEventType.ContributionApplied,
        cellIndex,
        payload: { category: analysis.category, name: disease.name, diseaseId: disease.id },
        contributionId,
        importance: 0.75,
      });
      world.contributionRoots[contributionId] = ev.seq;
      emitEvent(world, {
        type: WorldEventType.DiseaseOutbreak,
        cellIndex,
        payload: { name: disease.name },
        causes: [ev.seq],
        contributionId,
        importance: 0.7,
      });
      return { ok: true, rootEvent: ev, entityId: disease.id };
    }

    case ContributionCategory.NaturalPhenomenon: {
      world.grid.volcanic[cellIndex] = clamp01((world.grid.volcanic[cellIndex] ?? 0) + t.energyOutput * 0.5);
      world.grid.moisture[cellIndex] = clamp01((world.grid.moisture[cellIndex] ?? 0) + t.waterNeed * 0.3 - 0.15);
      const ev = emitEvent(world, {
        type: WorldEventType.ContributionApplied,
        cellIndex,
        payload: { category: analysis.category, name: analysis.name },
        contributionId,
        importance: 0.65,
      });
      world.contributionRoots[contributionId] = ev.seq;
      emitEvent(world, {
        type: WorldEventType.ClimateChanged,
        cellIndex,
        payload: { driver: analysis.name },
        causes: [ev.seq],
        contributionId,
        importance: 0.55,
      });
      return { ok: true, rootEvent: ev };
    }

    case ContributionCategory.WorldLaw: {
      const modifier = t.pollutionAbsorption > 0.5
        ? "pollutionCap"
        : t.aggression < 0.2
          ? "warReluctance"
          : t.growthRate > 0.5
            ? "plantGrowthMultiplier"
            : "volcanoSuppression";
      const law = {
        id: nextId(world, "law"),
        name: analysis.name,
        modifier,
        factor: modifier === "pollutionCap" ? clamp01(1 - t.pollutionAbsorption * 0.8) : clamp01(0.5 + t.growthRate * 0.7),
        createdTick: world.tick,
        contributionId,
      };
      world.laws.push(law);
      const ev = emitEvent(world, {
        type: WorldEventType.ContributionApplied,
        payload: { category: analysis.category, name: law.name, modifier, factor: law.factor },
        contributionId,
        importance: 0.85,
      });
      world.contributionRoots[contributionId] = ev.seq;
      return { ok: true, rootEvent: ev, entityId: law.id };
    }

    case ContributionCategory.Culture: {
      const affected = world.civs.filter((c) => !c.fallen && c.cells.some((cell) => Math.abs(cell - cellIndex) < world.grid.width * 2));
      for (const civ of affected) {
        civ.happiness = clamp01(civ.happiness + 0.05 + t.intelligence * 0.05);
        civ.stability = clamp01(civ.stability + 0.02);
      }
      const ev = emitEvent(world, {
        type: WorldEventType.ContributionApplied,
        cellIndex,
        civIds: affected.map((c) => c.id),
        payload: { category: analysis.category, name: analysis.name, affectedCivs: affected.map((c) => c.name) },
        contributionId,
        importance: 0.55,
      });
      world.contributionRoots[contributionId] = ev.seq;
      return { ok: true, rootEvent: ev };
    }

    case ContributionCategory.Custom:
    default: {
      // Deterministic mapping to the closest concrete category.
      const mapped = t.energyOutput > 0.5
        ? ContributionCategory.Resource
        : t.reproductionRate > 0.4 && t.intelligence < 0.5
          ? ContributionCategory.Plant
          : t.intelligence > 0.6
            ? ContributionCategory.Invention
            : ContributionCategory.Creature;
      return applyContribution(world, contributionId, { ...analysis, category: mapped }, cellIndex);
    }
  }
}

function makeSpeciesFromTraits(
  world: WorldState,
  analysis: AnalyzedContribution,
  kind: "flora" | "fauna",
  contributionId: string,
): Species {
  const t = analysis.traits;
  return {
    id: nextId(world, "species"),
    name: analysis.name || speciesName(world.rng, "contribution"),
    kind,
    diet: kind === "flora" ? "photosynthesis" : t.aggression > 0.6 ? "carnivore" : t.aggression > 0.35 ? "omnivore" : "herbivore",
    size: t.size,
    speed: kind === "flora" ? 0 : t.spreadRate,
    lifespan: t.lifespan,
    reproductionRate: Math.max(0.05, t.reproductionRate),
    intelligence: t.intelligence,
    aggression: t.aggression,
    adaptability: t.adaptability,
    mutationRate: 0.005 + t.adaptability * 0.02,
    coldResistance: t.coldResistance,
    heatResistance: t.heatResistance,
    waterNeed: t.waterNeed,
    pollutionAbsorption: t.pollutionAbsorption,
    nightLuminosity: t.nightLuminosity,
    toxicity: t.toxicity,
    cells: {},
    prey: [],
    predators: [],
    extinct: false,
    bornTick: world.tick,
    contributionId,
  };
}

function nearestCiv(world: WorldState, cell: number): Civilization | undefined {
  let best: Civilization | undefined;
  let bestDist = Infinity;
  for (const civ of world.civs) {
    if (civ.fallen) continue;
    const d = Math.abs(civ.capitalCell - cell);
    if (d < bestDist) {
      bestDist = d;
      best = civ;
    }
  }
  return best;
}

/** Success probability for the preview step: habitat fit + competition. */
export function placementSuccess(world: WorldState, analysis: AnalyzedContribution, cell: number): number {
  const t = analysis.traits;
  const probe = makeSpeciesFromTraits(world, analysis, "flora", "probe");
  switch (analysis.category) {
    case ContributionCategory.Plant:
    case ContributionCategory.Creature:
      return clamp01(habitatSuitability(world, probe, cell) * (0.6 + t.adaptability * 0.4) + 0.1);
    case ContributionCategory.Civilization: {
      const b = BIOME_ORDER[world.grid.biome[cell] ?? 0] ?? BiomeType.Ocean;
      return clamp01(habitability(b) * 0.9 + 0.05);
    }
    default:
      return 0.85;
  }
}

export function quickImpactEstimate(world: WorldState, analysis: AnalyzedContribution): { environmental: number; economic: number } {
  const t = analysis.traits;
  const environmental = clamp01(t.pollutionAbsorption * 0.6 + t.growthRate * 0.2 - t.pollutionEmission * 0.5 - t.toxicity * 0.3 + 0.3);
  const economic = clamp01(t.energyOutput * 0.5 + t.rarity * 0.3 + t.intelligence * 0.2);
  void world;
  return { environmental, economic };
}

export function totalSpeciesPopulation(s: Species): number {
  return speciesPopulation(s);
}

export { random };

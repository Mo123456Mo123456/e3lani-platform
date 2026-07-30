import { clamp, clamp01, type SystemContext } from "../context.js";
import { deterministicId } from "../rng.js";
import { declareWar, maybeFormAlliance, startMigration, warScore } from "./conflict.js";
import { techEffects, tryCreateTradeRoute } from "./economy.js";
import type { CivStateInternal, DiseaseInternal } from "../types.js";

const TECH_ERA_ORDER = ["stone", "bronze", "iron", "classical", "medieval", "industrial", "atomic", "information", "fusion"] as const;

/**
 * Agent-based civilization tick. Each civ evaluates its needs and scores a
 * small set of strategic actions (Utility AI), then executes the best one.
 */
export function tickCivilizations(ctx: SystemContext): void {
  const { state, rng, emit, grid, touch, yearsPerTick } = ctx;

  for (const civ of state.civs.values()) {
    if (civ.extinct) continue;
    const fx = techEffects(civ, state.techTree);

    // ---- needs ------------------------------------------------------------
    const farming = 0.35 + (fx.farming ?? 0);
    let foodProduced = 0;
    let cellCapSum = 0;
    for (const idx of civ.territory) {
      const cell = state.cells[idx]!;
      const drought = cell.droughtTicks > 0 ? 0.5 : 1;
      foodProduced += cell.fertility * 1400 * farming * drought;
      cellCapSum += Math.max(1000, cell.fertility * 2_000_000);
    }
    const foodNeeded = Math.max(1, civ.population);
    civ.foodSecurity = clamp(foodProduced / foodNeeded, 0, 1.3);

    // population dynamics, hard-capped by territory carrying capacity
    const medicine = fx.medicine ?? 0;
    const growthRate = (0.018 + medicine * 0.02) * clamp(civ.foodSecurity, 0, 1.1) * (0.5 + civ.health * 0.5) - diseaseMortality(ctx, civ);
    civ.population = Math.min(cellCapSum, Math.max(50, civ.population * (1 + growthRate * yearsPerTick * 0.4)));
    if (civ.population >= cellCapSum * 0.999) civ.population = cellCapSum;

    // distribute population over owned cells, respecting per-cell caps
    let remaining = civ.population;
    const ownedCells = [...civ.territory];
    for (const idx of ownedCells) {
      const cell = state.cells[idx]!;
      const cap = Math.max(1000, cell.fertility * 2_000_000);
      const share = Math.min(cap, remaining / Math.max(1, ownedCells.length - ownedCells.indexOf(idx)));
      if (Math.abs(cell.population - share) > cap * 0.02) touch(idx);
      cell.population = share;
      remaining -= share;
    }

    // health & pollution from industry
    const industry = fx.industry ?? 0;
    const emission = civ.population * civ.pollutionPerCapita * (0.5 + industry) * 0.0004 * yearsPerTick;
    for (const cityId of civ.cityIds) {
      const city = state.cities.get(cityId);
      if (!city) continue;
      const cell = state.cells[city.cellIndex]!;
      cell.pollution = clamp01(cell.pollution + emission / Math.max(1, civ.cityIds.length));
      city.health = clamp01(0.4 + medicine * 0.5 - cell.pollution * 0.5 + (fx.energy ?? 0) * 0.1);
      city.population = Math.min(Math.max(1000, cell.fertility * 2_000_000), Math.max(50, city.population * (1 + growthRate * 0.5 * yearsPerTick)));
      city.prosperity = clamp01(city.prosperity + (civ.economy - 0.5) * 0.02 * yearsPerTick);
      touch(city.cellIndex);
    }
    civ.health = clamp01(0.5 + medicine * 0.4 - meanTerritoryPollution(ctx, civ) * 0.6);
    civ.stability = clamp01(civ.stability + (civ.foodSecurity > 1 ? 0.004 : -0.006) * yearsPerTick + (civ.happiness - 0.5) * 0.004);
    civ.happiness = clamp01(civ.happiness + (civ.foodSecurity - 0.9) * 0.01 * yearsPerTick - meanTerritoryPollution(ctx, civ) * 0.003);
    civ.education = clamp01(civ.education + (fx.science ?? 0) * 0.002 * yearsPerTick + civ.economy * 0.0008 * yearsPerTick);

    // ---- research -----------------------------------------------------------
    const nextTech = state.techTree
      .filter((t) => !civ.techKeys.has(t.key) && t.prereqKeys.every((p) => civ.techKeys.has(p)))
      .sort((a, b) => a.cost - b.cost)[0];
    if (nextTech) {
      civ.researchProgress += (civ.innovation * 0.6 + civ.education * 0.4) * (0.02 + (fx.science ?? 0) * 0.04) * yearsPerTick * (1 + industry * 0.2);
      if (civ.researchProgress >= nextTech.cost) {
        civ.researchProgress = 0;
        civ.techKeys.add(nextTech.key);
        const capital = state.cities.get(civ.capitalCityId ?? "");
        emit("TECHNOLOGY_DISCOVERED", {
          region: capital?.cellIndex ?? [...civ.territory][0] ?? null,
          actorIds: [civ.id],
          causeIds: civ.memory.slice(-1).length > 0 ? civ.memory.slice(-1) : [ctx.genesisIds.life],
          magnitude: 0.4 + TECH_ERA_ORDER.indexOf(nextTech.era) * 0.04,
          title: `${civ.name} discovers ${nextTech.name}`,
          summary: `Scholars of ${civ.name} mastered ${nextTech.name} (${nextTech.era} age).`,
          data: { civId: civ.id, tech: nextTech.key, era: nextTech.era },
        });
        // era upgrade
        const eraTechs = state.techTree.filter((t) => t.era === nextTech.era);
        const owned = eraTechs.filter((t) => civ.techKeys.has(t.key)).length;
        if (owned >= Math.ceil(eraTechs.length * 0.5) && TECH_ERA_ORDER.indexOf(nextTech.era) > TECH_ERA_ORDER.indexOf(civ.techEra)) {
          civ.techEra = nextTech.era;
        }
      }
    }

    // ---- utility AI: pick the best strategic action --------------------------
    const scores: Array<{ action: string; score: number; target?: CivStateInternal }> = [];
    const popPressure = clamp01(civ.population / Math.max(1, cellCapSum) - 0.5);
    const freeFertile = countFreeFertileNeighbors(ctx, civ);
    scores.push({ action: "expand", score: 0.25 + popPressure * 0.5 + Math.min(0.3, freeFertile * 0.05) + clamp01(civ.foodSecurity - 0.8) * 0.2 });
    scores.push({ action: "city", score: civ.population > 3500 * Math.pow(civ.cityIds.length, 1.4) ? 0.55 : 0 });
    scores.push({ action: "trade", score: 0.2 + (1 - civ.economy) * 0.3 + (hasTradePartner(ctx, civ) ? 0.2 : 0) });
    scores.push({ action: "ally", score: 0.15 + bestRelation(ctx, civ) * 0.4 });
    let warTarget: CivStateInternal | undefined;
    let bestWar = 0;
    if ((civ.actionCooldowns["war"] ?? 0) <= state.tick) {
      for (const other of state.civs.values()) {
        if (other.id === civ.id || other.extinct) continue;
        if (!areNeighbors(ctx, civ, other)) continue;
        const s = warScore(ctx, civ, other);
        if (s > bestWar) {
          bestWar = s;
          warTarget = other;
        }
      }
    }
    scores.push({ action: "war", score: bestWar, target: warTarget });
    scores.push({ action: "migrate", score: civ.foodSecurity < 0.45 || civ.stability < 0.25 ? 0.65 : 0 });
    scores.push({ action: "reform", score: civ.stability < 0.32 ? 0.5 + (0.32 - civ.stability) : 0 });

    scores.sort((a, b) => b.score - a.score);
    const chosen = scores[0]!;
    const cooldownKey = chosen.action;
    if ((civ.actionCooldowns[cooldownKey] ?? 0) <= state.tick) {
      switch (chosen.action) {
        case "expand": {
          if (freeFertile === 0) break;
          expandTerritory(ctx, civ);
          civ.actionCooldowns["expand"] = state.tick + 2;
          break;
        }
        case "city": {
          foundCity(ctx, civ);
          civ.actionCooldowns["city"] = state.tick + 5;
          break;
        }
        case "trade": {
          const partner = pickTradePartner(ctx, civ);
          if (partner) {
            tryCreateTradeRoute(ctx, civ, partner);
            civ.relations[partner.id] = clamp01((civ.relations[partner.id] ?? 0) + 0.05 + 0.5) - 0.5;
            civ.actionCooldowns["trade"] = state.tick + 4;
          }
          break;
        }
        case "ally": {
          maybeFormAlliance(ctx, civ);
          break;
        }
        case "war": {
          if (warTarget && bestWar > 0.72) {
            declareWar(ctx, civ, warTarget, bestWar);
          }
          break;
        }
        case "migrate": {
          const origin = [...civ.territory].sort((a, b) => state.cells[a]!.fertility - state.cells[b]!.fertility)[0];
          if (origin !== undefined) {
            const cause = ctx.lastEventByCell.get(origin) ?? civ.memory[civ.memory.length - 1] ?? ctx.genesisIds.life;
            startMigration(ctx, civ, origin, cause, Math.floor(civ.population * 0.1) + 100);
          }
          civ.actionCooldowns["migrate"] = state.tick + 6;
          break;
        }
        case "reform": {
          const next = civ.military > 0.7 ? "empire" : civ.education > 0.4 ? "republic" : civ.stability < 0.2 ? "chiefdom" : "monarchy";
          if (next !== civ.government) {
            civ.government = next as CivStateInternal["government"];
            civ.stability = clamp01(civ.stability + 0.1);
            emit("GOVERNMENT_CHANGED", {
              region: [...civ.territory][0] ?? null,
              actorIds: [civ.id],
              causeIds: civ.memory.slice(-1).length > 0 ? civ.memory.slice(-1) : [ctx.genesisIds.life],
              magnitude: 0.4,
              title: `${civ.name} reforms`,
              summary: `Unrest forced ${civ.name} to adopt a ${next} government.`,
              data: { civId: civ.id, government: next },
            });
          }
          civ.actionCooldowns["reform"] = state.tick + 10;
          break;
        }
      }
    }

    // ---- disease ---------------------------------------------------------------
    const density = civ.population / Math.max(1, civ.territory.size * 3000);
    const atWar = [...state.wars.values()].some((w) => w.status === "active" && (w.attackerCivId === civ.id || w.defenderCivId === civ.id));
    if (rng.chance(density * (1 - civ.health) * (atWar ? 2 : 1) * 0.008 * yearsPerTick) && civ.cityIds.length > 0) {
      const cityId = civ.cityIds[rng.int(civ.cityIds.length)]!;
      const city = state.cities.get(cityId)!;
      const id = deterministicId("ds", state.seed, state.tick, civ.id);
      const disease: DiseaseInternal = {
        id,
        name: `${city.name} fever`,
        originContributionId: null,
        severity: rng.range(0.1, 0.6),
        contagiousness: rng.range(0.2, 0.8),
        affectedCivIds: new Set([civ.id]),
        startedTick: state.tick,
        contained: false,
        cells: new Set([city.cellIndex]),
      };
      state.diseases.set(id, disease);
      const ev = emit("DISEASE_OUTBREAK", {
        region: city.cellIndex,
        actorIds: [civ.id, cityId],
        causeIds: [ctx.lastEventByCell.get(city.cellIndex) ?? ctx.genesisIds.life],
        magnitude: 0.5 + disease.severity * 0.3,
        title: `${disease.name} outbreak`,
        summary: `A fever is spreading in ${city.name} (${civ.name}).`,
        data: { diseaseId: id, severity: disease.severity },
      });
      civ.memory.push(ev.id);
      civ.health = clamp01(civ.health - 0.05);
    }
  }

  tickDiseases(ctx);
}

function diseaseMortality(ctx: SystemContext, civ: CivStateInternal): number {
  let m = 0;
  for (const d of ctx.state.diseases.values()) {
    if (!d.contained && d.affectedCivIds.has(civ.id)) m += d.severity * 0.02;
  }
  return m;
}

function meanTerritoryPollution(ctx: SystemContext, civ: CivStateInternal): number {
  if (civ.territory.size === 0) return 0;
  let sum = 0;
  for (const idx of civ.territory) sum += ctx.state.cells[idx]!.pollution;
  return sum / civ.territory.size;
}

function countFreeFertileNeighbors(ctx: SystemContext, civ: CivStateInternal): number {
  let count = 0;
  for (const idx of civ.territory) {
    for (const nb of ctx.grid.neighbors(idx)) {
      const cell = ctx.state.cells[nb]!;
      if (!cell.isOcean && !cell.ownerCivId && cell.fertility > 0.3) count++;
    }
  }
  return count;
}

function areNeighbors(ctx: SystemContext, a: CivStateInternal, b: CivStateInternal): boolean {
  for (const idx of a.territory) {
    for (const nb of ctx.grid.neighbors(idx)) {
      if (b.territory.has(nb)) return true;
    }
  }
  return false;
}

function expandTerritory(ctx: SystemContext, civ: CivStateInternal): void {
  const { state, emit, touch } = ctx;
  let best = -1;
  let bestScore = 0.3;
  for (const idx of civ.territory) {
    for (const nb of ctx.grid.neighbors(idx)) {
      const cell = state.cells[nb]!;
      if (cell.isOcean || cell.ownerCivId) continue;
      const score = cell.fertility + cell.river * 0.2 + (cell.resources.length > 0 ? 0.15 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = nb;
      }
    }
  }
  if (best < 0) return;
  const cell = state.cells[best]!;
  civ.territory.add(best);
  cell.ownerCivId = civ.id;
  cell.population = Math.min(Math.max(1000, cell.fertility * 2_000_000), 200);
  touch(best);
  // discovery of deposits inside newly claimed land
  const undiscovered = cell.resources.filter((r) => !r.discovered && r.amount > 0.05);
  if (undiscovered.length > 0) {
    const dep = undiscovered[0]!;
    dep.discovered = true;
    emit("RESOURCE_DISCOVERED", {
      region: best,
      actorIds: [civ.id],
      causeIds: [ctx.lastEventByCell.get(best) ?? ctx.genesisIds.formed],
      magnitude: 0.35 + (dep.kind === "gold" || dep.kind === "crystal" ? 0.2 : 0),
      title: `${dep.kind} discovered`,
      summary: `Settlers of ${civ.name} found ${dep.kind} while expanding.`,
      data: { civId: civ.id, kind: dep.kind },
    });
  }
}

function foundCity(ctx: SystemContext, civ: CivStateInternal): void {
  const { state, emit, touch, rng } = ctx;
  let best = -1;
  let bestScore = 0.45;
  for (const idx of civ.territory) {
    const cell = state.cells[idx]!;
    if (cell.cityId) continue;
    const farFromOthers = civ.cityIds.every((cid) => {
      const c = state.cities.get(cid);
      return c ? ctx.grid.distance(c.cellIndex, idx) > 3 : true;
    });
    if (!farFromOthers) continue;
    const score = cell.fertility + cell.river * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  }
  if (best < 0) return;
  const id = deterministicId("ct", state.seed, state.tick, civ.id, best);
  const name = `${civ.name} ${["Harbor", "Crossing", "Gate", "Fields", "Watch"][rng.int(5)]}`;
  state.cities.set(id, {
    id,
    name,
    civId: civ.id,
    cellIndex: best,
    population: 400,
    foundedTick: state.tick,
    isCapital: false,
    health: 0.6,
    prosperity: 0.4,
  });
  civ.cityIds.push(id);
  state.cells[best]!.cityId = id;
  touch(best);
  emit("CITY_CREATED", {
    region: best,
    actorIds: [civ.id, id],
    causeIds: [ctx.lastEventByCell.get(best) ?? ctx.genesisIds.life],
    magnitude: 0.35,
    title: `${name} founded`,
    summary: `${civ.name} founded the city of ${name}.`,
    data: { civId: civ.id, cityId: id },
  });
}

function bestRelation(ctx: SystemContext, civ: CivStateInternal): number {
  let best = 0;
  for (const [id, rel] of Object.entries(civ.relations)) {
    const other = ctx.state.civs.get(id);
    if (other && !other.extinct) best = Math.max(best, rel);
  }
  return best;
}

function hasTradePartner(ctx: SystemContext, civ: CivStateInternal): boolean {
  return pickTradePartner(ctx, civ) !== null;
}

function pickTradePartner(ctx: SystemContext, civ: CivStateInternal): CivStateInternal | null {
  let best: CivStateInternal | null = null;
  let bestScore = 0.1;
  for (const other of ctx.state.civs.values()) {
    if (other.id === civ.id || other.extinct) continue;
    const rel = civ.relations[other.id] ?? 0;
    if (rel < -0.2) continue;
    const existing = [...ctx.state.tradeRoutes.values()].some((r) => {
      const a = ctx.state.cities.get(r.fromCityId);
      const b = ctx.state.cities.get(r.toCityId);
      return r.active && ((a?.civId === civ.id && b?.civId === other.id) || (a?.civId === other.id && b?.civId === civ.id));
    });
    if (existing) continue;
    const score = rel + (1 - civ.economy) * 0.2 + Math.min(0.2, other.economy * 0.2);
    if (score > bestScore) {
      bestScore = score;
      best = other;
    }
  }
  return best;
}

function tickDiseases(ctx: SystemContext): void {
  const { state, rng, emit, touch, yearsPerTick } = ctx;
  for (const d of state.diseases.values()) {
    if (d.contained) continue;
    // spread to neighbours and along trade routes
    for (const idx of [...d.cells]) {
      if (!rng.chance(d.contagiousness * 0.25 * yearsPerTick)) continue;
      for (const nb of ctx.grid.neighbors(idx)) {
        if (d.cells.has(nb) || state.cells[nb]!.isOcean || state.cells[nb]!.population < 50) continue;
        d.cells.add(nb);
        touch(nb);
        const owner = state.cells[nb]!.ownerCivId;
        if (owner) d.affectedCivIds.add(owner);
      }
    }
    for (const route of state.tradeRoutes.values()) {
      if (!route.active) continue;
      const a = state.cities.get(route.fromCityId);
      const b = state.cities.get(route.toCityId);
      if (!a || !b) continue;
      if (d.cells.has(a.cellIndex) && !d.cells.has(b.cellIndex) && rng.chance(d.contagiousness * 0.4 * yearsPerTick)) {
        d.cells.add(b.cellIndex);
        d.affectedCivIds.add(b.civId);
        touch(b.cellIndex);
      }
    }
    // mortality
    for (const civId of d.affectedCivIds) {
      const civ = state.civs.get(civId);
      if (!civ || civ.extinct) continue;
      civ.population = Math.max(50, civ.population * (1 - d.severity * 0.01 * yearsPerTick));
    }
    // containment via medicine or time
    const duration = state.tick - d.startedTick;
    const medicineKnown = [...d.affectedCivIds].some((cid) => {
      const civ = state.civs.get(cid);
      return civ && (civ.techKeys.has("germ_theory") || civ.techKeys.has("antibiotics"));
    });
    if ((medicineKnown && duration > 3 && rng.chance(0.4 * yearsPerTick)) || duration > 25) {
      d.contained = true;
      emit("DISEASE_CONTAINED", {
        region: [...d.cells][0] ?? null,
        actorIds: [...d.affectedCivIds],
        causeIds: [ctx.lastEventByCell.get([...d.cells][0] ?? 0) ?? ctx.genesisIds.life],
        magnitude: 0.4,
        title: `${d.name} contained`,
        summary: `${d.name} was contained after ${duration} years.`,
        data: { diseaseId: d.id },
      });
    }
  }
}

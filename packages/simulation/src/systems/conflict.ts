import { clamp, clamp01, type SystemContext } from "../context.js";
import { findPath } from "../grid.js";
import { deterministicId } from "../rng.js";
import { techEffects } from "./economy.js";
import type { CivStateInternal, WarInternal } from "../types.js";

/**
 * Wars never start randomly: a declaration requires grievance, tension and a
 * favourable strength balance. Resolution weighs troops, technology, terrain,
 * supply distance (path-based), morale and alliances.
 */
export function militaryStrength(ctx: SystemContext, civ: CivStateInternal): number {
  const fx = techEffects(civ, ctx.state.techTree);
  const allies = alliesOf(ctx, civ.id);
  const allyBoost = allies.reduce((s, allyId) => {
    const ally = ctx.state.civs.get(allyId);
    return ally && !ally.extinct ? s + ally.military * 0.35 : s;
  }, 0);
  return (civ.military + allyBoost) * (0.5 + (fx.military ?? 0)) * (0.4 + civ.stability * 0.6) * Math.min(1.5, civ.population / 3000 + 0.4);
}

export function alliesOf(ctx: SystemContext, civId: string): string[] {
  const out: string[] = [];
  for (const al of ctx.state.alliances.values()) {
    if (al.status === "active" && al.memberCivIds.includes(civId)) {
      for (const m of al.memberCivIds) if (m !== civId) out.push(m);
    }
  }
  return out;
}

export function warScore(ctx: SystemContext, civ: CivStateInternal, target: CivStateInternal): number {
  const rel = civ.relations[target.id] ?? 0;
  const grievance = Math.max(0, -rel);
  // resource tension: does the target hold deposits we lack?
  let tension = 0;
  const myKinds = new Set<string>();
  for (const idx of civ.territory) for (const d of ctx.state.cells[idx]!.resources) if (d.amount > 0.05) myKinds.add(d.kind);
  for (const idx of target.territory) {
    for (const d of ctx.state.cells[idx]!.resources) {
      if (d.amount > 0.15 && !myKinds.has(d.kind)) tension += 0.04;
    }
  }
  tension = Math.min(0.4, tension);
  const strengthRatio = militaryStrength(ctx, civ) / Math.max(0.01, militaryStrength(ctx, target));
  const balanceFactor = clamp((strengthRatio - 0.9) * 0.8, -0.3, 0.4);
  const pressure = Math.max(0, 1 - civ.foodSecurity) * 0.25 + Math.max(0, civ.population / Math.max(1, civ.territory.size * 2500) - 0.8) * 0.15;
  const raw = grievance * 0.35 + tension + civ.aggression * 0.25 + balanceFactor + pressure;
  return raw * ctx.state.laws.warProbabilityMultiplier;
}

export function declareWar(ctx: SystemContext, attacker: CivStateInternal, defender: CivStateInternal, score: number): WarInternal {
  const { state, emit, grid } = ctx;
  const id = deterministicId("wr", state.seed, state.tick, attacker.id, defender.id);
  const front = borderCells(ctx, attacker, defender);
  const war: WarInternal = {
    id,
    name: `${attacker.name}–${defender.name} War`,
    attackerCivId: attacker.id,
    defenderCivId: defender.id,
    status: "active",
    startedTick: state.tick,
    endedTick: null,
    casualties: 0,
    frontCells: new Set(front),
    momentum: 0,
    causeEventId: "",
    causeSummary: `grievance ${(attacker.relations[defender.id] ?? 0).toFixed(2)}, score ${score.toFixed(2)}`,
  };
  state.wars.set(id, war);
  attacker.relations[defender.id] = -1;
  defender.relations[attacker.id] = -1;
  const ev = emit("WAR_STARTED", {
    region: front[0] ?? null,
    actorIds: [attacker.id, defender.id],
    causeIds: [ctx.lastEventByCell.get(front[0] ?? attacker.territory.values().next().value ?? 0) ?? ctx.genesisIds.life],
    magnitude: 0.75,
    title: war.name,
    summary: `${attacker.name} declared war on ${defender.name}. Drivers: ${war.causeSummary}.`,
    data: { warId: id, score },
  });
  war.causeEventId = ev.id;
  attacker.memory.push(ev.id);
  defender.memory.push(ev.id);
  attacker.actionCooldowns["war"] = state.tick + 12;
  return war;
}

function borderCells(ctx: SystemContext, a: CivStateInternal, b: CivStateInternal): number[] {
  const out: number[] = [];
  for (const idx of a.territory) {
    for (const nb of ctx.grid.neighbors(idx)) {
      if (b.territory.has(nb)) {
        out.push(idx);
        break;
      }
    }
  }
  return out;
}

export function tickWars(ctx: SystemContext): void {
  const { state, rng, emit, grid, touch, yearsPerTick } = ctx;
  for (const war of state.wars.values()) {
    if (war.status !== "active") continue;
    const att = state.civs.get(war.attackerCivId);
    const def = state.civs.get(war.defenderCivId);
    if (!att || !def || att.extinct || def.extinct) {
      war.status = "resolved";
      war.endedTick = state.tick;
      continue;
    }

    // refresh front
    const front = borderCells(ctx, att, def);
    if (front.length > 0) war.frontCells = new Set(front);
    const frontCell = [...war.frontCells][0] ?? [...att.territory][0]!;
    const attCap = state.cities.get(att.capitalCityId ?? "")?.cellIndex ?? frontCell;
    const defCap = state.cities.get(def.capitalCityId ?? "")?.cellIndex ?? frontCell;
    const fxA = techEffects(att, state.techTree);
    const fxD = techEffects(def, state.techTree);
    const supplyA = clamp(1.3 - grid.distance(attCap, frontCell) / (8 + (fxA.logistics ?? 0) * 25), 0.25, 1.2);
    const supplyD = clamp(1.3 - grid.distance(defCap, frontCell) / (8 + (fxD.logistics ?? 0) * 25), 0.25, 1.2);
    const terrainBonus = ["mountains", "swamp", "rainforest"].includes(state.cells[frontCell]!.biome) ? 0.25 : state.cells[frontCell]!.river > 0.3 ? 0.15 : 0;
    const weatherPenalty = state.cells[frontCell]!.storm * 0.3;
    const attPow = militaryStrength(ctx, att) * supplyA * (1 - weatherPenalty);
    const defPow = militaryStrength(ctx, def) * supplyD * (1 + terrainBonus);
    const ratio = attPow / Math.max(0.01, attPow + defPow);
    war.momentum = clamp(war.momentum + (ratio - 0.5) * 0.35 * yearsPerTick + rng.spread() * 0.03, -1, 1);

    // casualties & exhaustion
    const scale = Math.min(att.population, def.population) * 0.004 + 20;
    const attLoss = scale * (1 - ratio) * yearsPerTick;
    const defLoss = scale * ratio * yearsPerTick;
    att.population = Math.max(100, att.population - attLoss);
    def.population = Math.max(100, def.population - defLoss);
    war.casualties += attLoss + defLoss;
    att.stability = clamp01(att.stability - 0.008 * yearsPerTick);
    def.stability = clamp01(def.stability - 0.008 * yearsPerTick);
    att.happiness = clamp01(att.happiness - 0.006 * yearsPerTick);
    def.happiness = clamp01(def.happiness - 0.006 * yearsPerTick);

    // territory capture
    if (war.momentum > 0.4 && front.length > 0) {
      const cellIdx = front[rng.int(front.length)]!;
      transferCell(ctx, cellIdx, def, att, war);
      war.momentum *= 0.6;
    } else if (war.momentum < -0.4 && front.length > 0) {
      const cellIdx = front[rng.int(front.length)]!;
      transferCell(ctx, cellIdx, att, def, war);
      war.momentum *= 0.6;
    }

    // refugees
    if (rng.chance(0.12 * yearsPerTick) && front.length > 0) {
      const from = front[rng.int(front.length)]!;
      startMigration(ctx, att.population > def.population ? def : att, from, war.causeEventId, 200 + rng.int(800));
    }

    // resolution
    const duration = state.tick - war.startedTick;
    const collapseThreat = def.territory.size <= 2 || att.territory.size <= 2;
    if (Math.abs(war.momentum) > 0.9 || duration > 20 || att.stability < 0.15 || def.stability < 0.15 || collapseThreat) {
      endWar(ctx, war, att, def);
    }
  }
}

function transferCell(ctx: SystemContext, idx: number, from: CivStateInternal, to: CivStateInternal, war: WarInternal): void {
  const cell = ctx.state.cells[idx]!;
  from.territory.delete(idx);
  to.territory.add(idx);
  cell.ownerCivId = to.id;
  ctx.touch(idx);
  if (cell.cityId) {
    const city = ctx.state.cities.get(cell.cityId);
    if (city) {
      if (ctx.rng.chance(0.25)) {
        ctx.state.cities.delete(city.id);
        cell.cityId = null;
        from.cityIds = from.cityIds.filter((c) => c !== city.id);
        ctx.emit("CITY_DESTROYED", {
          region: idx,
          actorIds: [city.id, to.id],
          causeIds: [war.causeEventId],
          magnitude: 0.7,
          title: `${city.name} razed`,
          summary: `${city.name} was destroyed in the fighting.`,
          data: { warId: war.id },
        });
      } else {
        const oldCivId = city.civId;
        city.civId = to.id;
        to.cityIds.push(city.id);
        const old = ctx.state.civs.get(oldCivId);
        if (old) old.cityIds = old.cityIds.filter((c) => c !== city.id);
        if (from.capitalCityId === city.id) from.capitalCityId = to.cityIds.length > 0 ? city.id : null;
      }
    }
  }
}

function endWar(ctx: SystemContext, war: WarInternal, att: CivStateInternal, def: CivStateInternal): void {
  const { state, emit, rng } = ctx;
  war.status = "resolved";
  war.endedTick = state.tick;
  const winner = war.momentum > 0 ? att : war.momentum < 0 ? def : null;
  const loser = winner === att ? def : winner === def ? att : null;
  if (winner && loser) {
    const tribute = (loser.stockpiles["grain"] ?? 0) * 0.3;
    loser.stockpiles["grain"] = (loser.stockpiles["grain"] ?? 0) - tribute;
    winner.stockpiles["grain"] = clamp01((winner.stockpiles["grain"] ?? 0) + tribute);
    winner.military = clamp01(winner.military + 0.05);
    loser.military = clamp01(loser.military - 0.1);
  }
  att.relations[def.id] = -0.6;
  def.relations[att.id] = -0.6;
  const ev = emit("WAR_ENDED", {
    region: [...war.frontCells][0] ?? null,
    actorIds: [att.id, def.id],
    causeIds: [war.causeEventId],
    magnitude: 0.7,
    title: `${war.name} ends`,
    summary: winner ? `${winner.name} prevailed after ${state.tick - war.startedTick} years and ${Math.round(war.casualties)} casualties.` : `The war fizzled into stalemate.`,
    data: { warId: war.id, casualties: Math.round(war.casualties), winnerId: winner?.id ?? "" },
  });
  emit("TREATY_SIGNED", {
    region: null,
    actorIds: [att.id, def.id],
    causeIds: [ev.id],
    magnitude: 0.4,
    title: `Treaty of ${war.name}`,
    summary: `${att.name} and ${def.name} signed a peace treaty redrawing their frontier.`,
    data: { warId: war.id },
  });
  att.memory.push(ev.id);
  def.memory.push(ev.id);

  // collapse & successor state
  for (const civ of [att, def]) {
    if (civ.territory.size <= 2 && !civ.extinct) {
      civ.extinct = true;
      const cev = emit("CIVILIZATION_COLLAPSED", {
        region: [...civ.territory][0] ?? null,
        actorIds: [civ.id],
        causeIds: [ev.id],
        magnitude: 0.85,
        title: `${civ.name} collapses`,
        summary: `${civ.name} ceased to exist as a state after the war.`,
        data: { civId: civ.id },
      });
      // rebels may found a successor state in the largest remaining city
      const remainingCity = civ.cityIds.map((id) => state.cities.get(id)).find((c) => c && state.cells[c.cellIndex]!.ownerCivId === civ.id);
      if (remainingCity && rng.chance(0.5)) {
        const nid = deterministicId("cv", state.seed, state.tick, "rebirth", civ.id);
        const cell = state.cells[remainingCity.cellIndex]!;
        const successor: CivStateInternal = {
          ...structuredCloneShallow(civ),
          id: nid,
          name: `New ${civ.name}`,
          color: civ.color,
          foundedTick: state.tick,
          extinct: false,
          stability: 0.5,
          military: 0.3,
          population: Math.max(300, remainingCity.population * 0.5),
          territory: new Set([remainingCity.cellIndex]),
          cityIds: [remainingCity.id],
          capitalCityId: remainingCity.id,
          memory: [cev.id],
          relations: {},
        };
        remainingCity.civId = nid;
        cell.ownerCivId = nid;
        state.civs.set(nid, successor);
        emit("CIVILIZATION_FOUNDED", {
          region: remainingCity.cellIndex,
          actorIds: [nid],
          causeIds: [cev.id],
          magnitude: 0.55,
          title: `${successor.name} rises`,
          summary: `From the ashes of ${civ.name}, rebels proclaimed ${successor.name}.`,
          data: { civId: nid, predecessor: civ.id },
        });
      }
    }
  }
}

function structuredCloneShallow(civ: CivStateInternal): CivStateInternal {
  return {
    ...civ,
    territory: new Set(civ.territory),
    cityIds: [...civ.cityIds],
    techKeys: new Set(civ.techKeys),
    stockpiles: { ...civ.stockpiles },
    relations: { ...civ.relations },
    memory: [...civ.memory],
    actionCooldowns: { ...civ.actionCooldowns },
  };
}

/** Alliance formation check — requires high mutual relations and a common rival. */
export function maybeFormAlliance(ctx: SystemContext, civ: CivStateInternal): void {
  const { state, emit, rng } = ctx;
  if ((civ.actionCooldowns["ally"] ?? 0) > state.tick) return;
  let best: CivStateInternal | null = null;
  let bestRel = 0.55;
  for (const other of state.civs.values()) {
    if (other.id === civ.id || other.extinct) continue;
    if (alliesOf(ctx, civ.id).includes(other.id)) continue;
    const rel = Math.min(civ.relations[other.id] ?? 0, other.relations[civ.id] ?? 0);
    if (rel > bestRel) {
      bestRel = rel;
      best = other;
    }
  }
  if (!best) return;
  const commonRival = [...state.civs.values()].some(
    (o) => !o.extinct && o.id !== civ.id && o.id !== best!.id && (civ.relations[o.id] ?? 0) < -0.2 && (best!.relations[o.id] ?? 0) < -0.2,
  );
  if (!commonRival && !rng.chance(0.3)) return;
  const id = deterministicId("al", state.seed, state.tick, civ.id, best.id);
  const alliance = {
    id,
    name: `${civ.name}–${best.name} Pact`,
    memberCivIds: [civ.id, best.id],
    status: "active" as const,
    createdTick: state.tick,
    brokenTick: null,
  };
  state.alliances.set(id, alliance);
  civ.actionCooldowns["ally"] = state.tick + 15;
  const aev = emit("ALLIANCE_CREATED", {
    region: null,
    actorIds: [civ.id, best.id],
    causeIds: civ.memory.slice(-1).length > 0 ? civ.memory.slice(-1) : [ctx.genesisIds.life],
    magnitude: 0.5,
    title: alliance.name,
    summary: `${civ.name} and ${best.name} formalised a defensive alliance.`,
    data: { allianceId: id },
  });
  civ.memory.push(aev.id);
}

export function tickAlliances(ctx: SystemContext): void {
  const { state, rng, emit } = ctx;
  for (const al of state.alliances.values()) {
    if (al.status !== "active") continue;
    // betrayal when relations rot
    const [a, b] = al.memberCivIds;
    const civA = a ? state.civs.get(a) : undefined;
    const civB = b ? state.civs.get(b) : undefined;
    if (!civA || !civB || civA.extinct || civB.extinct) {
      al.status = "broken";
      al.brokenTick = state.tick;
      continue;
    }
    if ((civA.relations[civB.id] ?? 0) < -0.3 && rng.chance(0.03)) {
      al.status = "broken";
      al.brokenTick = state.tick;
      emit("ALLIANCE_BROKEN", {
        region: null,
        actorIds: [...al.memberCivIds],
        causeIds: civA.memory.slice(-1).length > 0 ? civA.memory.slice(-1) : [ctx.genesisIds.life],
        magnitude: 0.45,
        title: `${al.name} dissolved`,
        summary: `${civA.name} abandoned the ${al.name}.`,
        data: { allianceId: al.id },
      });
    }
  }
}

/** queued into civilization system — defined here to keep movement logic together */
export function startMigration(ctx: SystemContext, civ: CivStateInternal, fromIndex: number, causeEventId: string, size: number): void {
  const { state, grid, rng, emit } = ctx;
  // find best refuge: fertile, peaceful, owned or unowned, reachable
  let target = -1;
  let bestScore = 0.3;
  const candidates: number[] = [];
  for (const idx of civ.territory) {
    if (idx !== fromIndex) candidates.push(idx);
  }
  for (let i = 0; i < 40; i++) {
    const probe = rng.int(state.cells.length);
    if (!state.cells[probe]!.isOcean) candidates.push(probe);
  }
  for (const idx of candidates) {
    const cell = state.cells[idx]!;
    const contested = [...state.wars.values()].some((w) => w.status === "active" && w.frontCells.has(idx));
    const score = cell.fertility * (contested ? 0.2 : 1) * (1 - cell.pollution);
    if (score > bestScore) {
      bestScore = score;
      target = idx;
    }
  }
  if (target < 0) return;
  const seafaring = civ.techKeys.has("sailing") || civ.techKeys.has("navigation");
  const path = findPath(grid, fromIndex, target, {
    passable: (idx) => {
      const cell = state.cells[idx]!;
      if (!cell.isOcean) return true;
      return seafaring;
    },
    cost: (idx) => 1 + state.cells[idx]!.storm * 2 + (state.cells[idx]!.isOcean ? 0.5 : 0),
  });
  if (!path) return; // no safe route — migration does not happen
  const id = deterministicId("mg", state.seed, state.tick, fromIndex, target);
  state.migrations.set(id, {
    id,
    civId: civ.id,
    speciesId: null,
    fromIndex,
    toIndex: target,
    path,
    size,
    startedTick: state.tick,
    completedTick: null,
    progress: 0,
    causeEventId,
  });
  emit("MIGRATION_STARTED", {
    region: fromIndex,
    actorIds: [civ.id],
    causeIds: [causeEventId],
    magnitude: 0.4,
    title: `${civ.name} migration`,
    summary: `${size} people of ${civ.name} fled toward safer lands.`,
    data: { migrationId: id, size },
  });
}

export function tickMigrations(ctx: SystemContext): void {
  const { state, emit, touch, yearsPerTick } = ctx;
  for (const mig of state.migrations.values()) {
    if (mig.completedTick !== null) continue;
    mig.progress += 0.25 * yearsPerTick;
    if (mig.progress < 1) continue;
    mig.completedTick = state.tick;
    const cell = state.cells[mig.toIndex]!;
    const civ = mig.civId ? state.civs.get(mig.civId) : undefined;
    const cap = Math.max(1000, cell.fertility * 2_000_000);
    cell.population = Math.min(cap, cell.population + mig.size);
    if (civ && !civ.extinct) {
      civ.population += mig.size * 0.2; // net survivors integrate
      if (!cell.ownerCivId) {
        cell.ownerCivId = civ.id;
        civ.territory.add(mig.toIndex);
      }
    }
    touch(mig.toIndex);
    emit("MIGRATION_COMPLETED", {
      region: mig.toIndex,
      actorIds: mig.civId ? [mig.civId] : [],
      causeIds: [mig.causeEventId],
      magnitude: 0.35,
      title: "Migrants arrive",
      summary: `${mig.size} migrants settled a new home.`,
      data: { migrationId: mig.id },
    });
  }
}

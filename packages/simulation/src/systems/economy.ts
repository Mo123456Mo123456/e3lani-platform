import { clamp, clamp01, type SystemContext } from "../context.js";
import { findPath } from "../grid.js";
import { deterministicId } from "../rng.js";
import type { CivStateInternal, TradeRouteInternal } from "../types.js";

/** aggregated technology effects for a civ */
export function techEffects(civ: CivStateInternal, tree: import("../types.js").TechNode[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const node of tree) {
    if (!civ.techKeys.has(node.key)) continue;
    for (const [k, v] of Object.entries(node.effects)) out[k] = (out[k] ?? 0) + (v ?? 0);
  }
  return out;
}

export function hasSeafaring(civ: CivStateInternal): boolean {
  return civ.techKeys.has("sailing") || civ.techKeys.has("navigation") || civ.techKeys.has("compass") || civ.techKeys.has("spaceflight");
}

/**
 * Resource extraction, depletion and inter-city trade.
 * Routes are computed with A*; cost folds in terrain, risk and technology.
 */
export function tickEconomy(ctx: SystemContext): void {
  const { state, rng, emit, yearsPerTick } = ctx;
  let eventsLeft = 6;

  // --- extraction & stockpiles ------------------------------------------------
  for (const civ of state.civs.values()) {
    if (civ.extinct) continue;
    const fx = techEffects(civ, state.techTree);
    const extractionRate = 0.015 + (fx.industry ?? 0) * 0.02;
    let extractedValue = 0;
    for (const idx of civ.territory) {
      const cell = state.cells[idx]!;
      for (const dep of cell.resources) {
        if (dep.amount <= 0.01) continue;
        const needsTech =
          (dep.kind === "oil" && !civ.techKeys.has("oil_refining")) ||
          (dep.kind === "uranium" && !civ.techKeys.has("nuclear_power")) ||
          (dep.kind === "coal" && !civ.techKeys.has("steam_engine"));
        if (needsTech) continue;
        const take = Math.min(dep.amount, extractionRate * yearsPerTick);
        dep.amount -= take;
        civ.stockpiles[dep.kind] = clamp01((civ.stockpiles[dep.kind] ?? 0) + take * 2);
        extractedValue += take;
        if (dep.amount <= 0.01 && eventsLeft > 0) {
          eventsLeft--;
          emit("RESOURCE_DEPLETED", {
            region: idx,
            actorIds: [civ.id],
            causeIds: [ctx.lastEventByCell.get(idx) ?? ctx.genesisIds.formed],
            magnitude: 0.45,
            title: `${dep.kind} depleted`,
            summary: `${civ.name} exhausted the ${dep.kind} deposits of this region.`,
            data: { kind: dep.kind, civId: civ.id },
          });
        }
        dep.amount = clamp01(dep.amount + dep.renewalRate * 0.01 * yearsPerTick);
      }
    }
    // consumption scales with population & industry
    const consume = 0.01 * yearsPerTick * (1 + (fx.industry ?? 0));
    for (const kind of Object.keys(civ.stockpiles)) {
      const k = kind as keyof typeof civ.stockpiles;
      civ.stockpiles[k] = clamp01((civ.stockpiles[k] ?? 0) - consume * 0.4);
    }
    const diversity = Object.values(civ.stockpiles).filter((v) => (v ?? 0) > 0.1).length;
    civ.economy = clamp01(civ.economy * 0.95 + (extractedValue * 3 + diversity * 0.02) * 0.05 * 20 * yearsPerTick * 0.05 + tradeIncome(ctx, civ.id) * 0.05);
    if (civ.economy < 0.15 && civ.foodSecurity < 0.4 && eventsLeft > 0) {
      eventsLeft--;
      emit("ECONOMIC_CRISIS", {
        region: null,
        actorIds: [civ.id],
        causeIds: civ.memory.slice(-1).length > 0 ? civ.memory.slice(-1) : [ctx.genesisIds.life],
        magnitude: 0.5,
        title: `${civ.name} in crisis`,
        summary: `Empty granaries and stalled trade pushed ${civ.name} into economic crisis.`,
        data: { civId: civ.id, economy: civ.economy },
      });
      civ.stability = clamp01(civ.stability - 0.03);
    }
  }

  // --- trade route upkeep -------------------------------------------------------
  for (const route of state.tradeRoutes.values()) {
    const a = state.cities.get(route.fromCityId);
    const b = state.cities.get(route.toCityId);
    if (!a || !b) {
      route.active = false;
      continue;
    }
    const civA = state.civs.get(a.civId);
    const civB = state.civs.get(b.civId);
    if (!civA || !civB || civA.extinct || civB.extinct) {
      route.active = false;
      continue;
    }
    const atWar = [...state.wars.values()].some(
      (w) => w.status === "active" && isWarPair(w.attackerCivId, w.defenderCivId, civA.id, civB.id),
    );
    if (atWar && route.active && eventsLeft > 0) {
      eventsLeft--;
      route.active = false;
      emit("TRADE_ROUTE_BROKEN", {
        region: route.path[Math.floor(route.path.length / 2)] ?? null,
        actorIds: [civA.id, civB.id],
        causeIds: [ctx.lastEventByCell.get(route.path[0] ?? 0) ?? ctx.genesisIds.life],
        magnitude: 0.4,
        title: "Trade route severed",
        summary: `War between ${civA.name} and ${civB.name} cut their trade route.`,
        data: { routeId: route.id },
      });
    }
  }
}

function isWarPair(a1: string, d1: string, a2: string, d2: string): boolean {
  return (a1 === a2 && d1 === d2) || (a1 === d2 && d1 === a2);
}

function tradeIncome(ctx: SystemContext, civId: string): number {
  let income = 0;
  for (const route of ctx.state.tradeRoutes.values()) {
    if (!route.active) continue;
    const a = ctx.state.cities.get(route.fromCityId);
    const b = ctx.state.cities.get(route.toCityId);
    if (a?.civId === civId || b?.civId === civId) income += route.value * 0.02;
  }
  return income;
}

/** Try to open a trade route between the civ's best city and a partner city. */
export function tryCreateTradeRoute(ctx: SystemContext, civ: CivStateInternal, partner: CivStateInternal): TradeRouteInternal | null {
  const { state, grid, rng, emit } = ctx;
  const fxA = techEffects(civ, state.techTree);
  const range = 12 + (fxA.logistics ?? 0) * 30;
  const myCities = civ.cityIds.map((id) => state.cities.get(id)!).filter(Boolean);
  const theirCities = partner.cityIds.map((id) => state.cities.get(id)!).filter(Boolean);
  if (myCities.length === 0 || theirCities.length === 0) return null;

  const seaOk = hasSeafaring(civ) && hasSeafaring(partner);
  let best: { path: number[]; a: (typeof myCities)[0]; b: (typeof myCities)[0] } | null = null;
  for (const a of myCities) {
    for (const b of theirCities) {
      if (grid.distance(a.cellIndex, b.cellIndex) > range) continue;
      const path = findPath(grid, a.cellIndex, b.cellIndex, {
        passable: (idx) => {
          const cell = state.cells[idx]!;
          if (!cell.isOcean) return true;
          return seaOk;
        },
        cost: (idx) => {
          const cell = state.cells[idx]!;
          let c = 1;
          if (cell.biome === "mountains") c += 1.5;
          if (cell.isOcean) c += 0.4;
          c += cell.storm * 3;
          if (cell.ownerCivId && cell.ownerCivId !== civ.id && cell.ownerCivId !== partner.id) c += 1.2;
          return c;
        },
      });
      if (path && (!best || path.length < best.path.length)) best = { path, a, b };
    }
  }
  if (!best) return null;

  const goods = complementaryGoods(civ, partner);
  if (goods.length === 0) return null;
  const id = deterministicId("tr", state.seed, state.tick, civ.id, partner.id);
  const route: TradeRouteInternal = {
    id,
    fromCityId: best.a.id,
    toCityId: best.b.id,
    path: best.path,
    goods,
    value: clamp01(goods.length * 0.2 + rng.range(0.1, 0.4)),
    risk: clamp01(best.path.reduce((s, i) => s + state.cells[i]!.storm + (state.cells[i]!.isOcean ? 0.05 : 0), 0) / best.path.length),
    active: true,
    createdTick: state.tick,
  };
  state.tradeRoutes.set(id, route);
  emit("TRADE_ROUTE_CREATED", {
    region: best.path[Math.floor(best.path.length / 2)] ?? null,
    actorIds: [civ.id, partner.id, best.a.id, best.b.id],
    causeIds: [ctx.lastEventByCell.get(best.a.cellIndex) ?? ctx.genesisIds.life],
    magnitude: 0.35,
    title: "Trade route opened",
    summary: `${civ.name} and ${partner.name} connected ${best.a.name} ↔ ${best.b.name} trading ${goods.join(", ")}.`,
    data: { routeId: route.id, goods: goods.join(",") },
  });
  return route;
}

function complementaryGoods(a: CivStateInternal, b: CivStateInternal): Array<keyof CivStateInternal["stockpiles"] & string> {
  const goods: Array<keyof CivStateInternal["stockpiles"] & string> = [];
  const kinds = ["grain", "timber", "iron", "gold", "spice", "fish", "copper", "stone"] as const;
  for (const k of kinds) {
    const av = a.stockpiles[k] ?? 0;
    const bv = b.stockpiles[k] ?? 0;
    if (Math.abs(av - bv) > 0.25) goods.push(k);
  }
  return goods;
}

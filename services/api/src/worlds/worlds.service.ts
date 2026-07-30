import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { LayerId, RegionData } from "@kawkab/shared-types";
import { PrismaService } from "../common/prisma.service.js";
import { WorldManager } from "./world-manager.js";

@Injectable()
export class WorldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: WorldManager,
  ) {}

  async listPlanets() {
    const planets = await this.prisma.planet.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, name: true, seed: true, status: true, tick: true, simYear: true, stats: true, createdAt: true, config: true },
      orderBy: { createdAt: "asc" },
    });
    return planets.map((p) => ({ ...p, live: this.manager.status(p.id) }));
  }

  async getPlanet(id: string) {
    const planet = await this.prisma.planet.findUnique({ where: { id } });
    if (!planet) throw new NotFoundException("planet not found");
    const stats = this.manager.statsOf(id) ?? planet.stats;
    return { ...planet, stats, live: this.manager.status(id) };
  }

  getRegion(planetId: string, index: number): RegionData & { civName?: string; cityName?: string } {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded (DATABASE_URL missing or planet archived)");
    const region = engine.getRegion(index);
    if (!region) throw new NotFoundException("region not found");
    const civName = region.ownerCivId ? engine.state.civs.get(region.ownerCivId)?.name : undefined;
    const cityName = region.cityId ? engine.state.cities.get(region.cityId)?.name : undefined;
    return { ...region, civName, cityName };
  }

  getLayer(planetId: string, layer: LayerId) {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    return engine.getLayer(layer);
  }

  getCivilizations(planetId: string) {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    return [...engine.state.civs.values()].map((c) => ({
      id: c.id, name: c.name, color: c.color, foundedTick: c.foundedTick, extinct: c.extinct,
      population: Math.round(c.population), territorySize: c.territory.size, techEra: c.techEra,
      government: c.government, military: c.military, stability: c.stability, happiness: c.happiness,
      health: c.health, education: c.education, economy: c.economy, foodSecurity: c.foodSecurity,
      techKeys: [...c.techKeys], cultureName: c.cultureName, languageName: c.languageName,
      cities: c.cityIds.length,
    }));
  }

  getCivilizationDetail(planetId: string, civId: string) {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    const civ = engine.state.civs.get(civId);
    if (!civ) throw new NotFoundException("civilization not found");
    const cities = civ.cityIds.map((id) => engine.state.cities.get(id)).filter(Boolean).map((city) => ({
      id: city!.id, name: city!.name, population: Math.round(city!.population), isCapital: city!.isCapital,
      lat: engine.grid.lat(city!.cellIndex), lon: engine.grid.lon(city!.cellIndex), health: city!.health, prosperity: city!.prosperity,
    }));
    const wars = [...engine.state.wars.values()].filter((w) => w.attackerCivId === civId || w.defenderCivId === civId);
    const alliances = [...engine.state.alliances.values()].filter((a) => a.memberCivIds.includes(civId));
    const territory = [...civ.territory].map((i) => ({ lat: engine.grid.lat(i), lon: engine.grid.lon(i), index: i }));
    return {
      id: civ.id, name: civ.name, color: civ.color, foundedTick: civ.foundedTick, extinct: civ.extinct,
      population: Math.round(civ.population), techEra: civ.techEra, techKeys: [...civ.techKeys],
      government: civ.government, military: civ.military, stability: civ.stability, happiness: civ.happiness,
      health: civ.health, education: civ.education, economy: civ.economy, foodSecurity: civ.foodSecurity,
      aggression: civ.aggression, innovation: civ.innovation, stockpiles: civ.stockpiles, relations: civ.relations,
      cultureName: civ.cultureName, languageName: civ.languageName, languageFamily: civ.languageFamily,
      cities, wars, alliances, territory,
    };
  }

  getSpeciesList(planetId: string) {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    return [...engine.state.species.values()].map((sp) => {
      const pops = engine.state.speciesPops.get(sp.id);
      const global = pops ? [...pops.values()].reduce((a, b) => a + b, 0) : 0;
      return {
        id: sp.id, name: sp.name, homeBiome: sp.homeBiome, diet: sp.diet, traits: sp.traits,
        globalPopulation: Math.round(global), cellCount: pops?.size ?? 0, extinct: sp.extinct,
        parentId: sp.parentId, originContributionId: sp.originContributionId, createdTick: sp.createdTick,
      };
    });
  }

  getPlantsList(planetId: string) {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    return [...engine.state.plants.values()].map((p) => ({
      id: p.id, name: p.name, biomes: p.biomes, traits: p.traits,
      coverage: p.cells.size > 0 ? p.cells.size : p.estimatedCoverage,
      extinct: p.extinct, originContributionId: p.originContributionId, createdTick: p.createdTick,
      tracked: p.cells.size > 0,
    }));
  }

  getTechnologies(planetId: string) {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    return engine.state.techTree.map((t) => ({
      key: t.key, name: t.name, era: t.era, prereqKeys: t.prereqKeys, effects: t.effects,
      discoveredBy: [...engine.state.civs.values()].filter((c) => c.techKeys.has(t.key)).map((c) => c.id),
    }));
  }

  getTradeRoutes(planetId: string) {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    return [...engine.state.tradeRoutes.values()].map((r) => ({
      id: r.id, fromCityId: r.fromCityId, toCityId: r.toCityId, goods: r.goods, value: r.value, risk: r.risk,
      active: r.active, createdTick: r.createdTick,
      path: r.path.map((i) => ({ lat: engine.grid.lat(i), lon: engine.grid.lon(i) })),
    }));
  }

  getAlliances(planetId: string) {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    return [...engine.state.alliances.values()].map((a) => ({ ...a, memberCivIds: a.memberCivIds }));
  }

  getWars(planetId: string) {
    const engine = this.manager.get(planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    return [...engine.state.wars.values()].map((w) => ({
      id: w.id, name: w.name, attackerCivId: w.attackerCivId, defenderCivId: w.defenderCivId, status: w.status,
      startedTick: w.startedTick, endedTick: w.endedTick, casualties: Math.round(w.casualties),
      frontCells: [...w.frontCells].map((i) => ({ lat: engine.grid.lat(i), lon: engine.grid.lon(i) })),
      causeSummary: w.causeSummary,
    }));
  }
}

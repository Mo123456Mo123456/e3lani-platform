/**
 * Seed: creates the sandbox accounts and a fully simulated demo planet.
 * The demo world is built by the REAL engine — 12 civs, 40+ cities, 120+
 * resource deposits, 300 species, 800 plants, 50 technologies, and a living
 * event history — then fast-forwarded so the timeline has depth.
 *
 *   pnpm --filter @kawkab/api seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SimulationEngine } from "@kawkab/simulation";

const prisma = new PrismaClient();

const DEMO_SEED = process.env.DEMO_PLANET_SEED ?? "kawkab-aether-144";
const FAST_FORWARD_TICKS = Number(process.env.SEED_TICKS ?? 80);

async function seedUsers(): Promise<void> {
  const password = await bcrypt.hash("Kawkab#2026", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@kawkab.dev" },
    create: {
      email: "admin@kawkab.dev",
      passwordHash: password,
      displayName: "مدير النظام",
      role: "SUPER_ADMIN",
      profile: { create: {} },
      roleGrants: { create: [{ role: "SUPER_ADMIN" }, { role: "SYS_ADMIN" }, { role: "SIM_ADMIN" }, { role: "MODERATOR" }] },
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: "explorer@kawkab.dev" },
    create: {
      email: "explorer@kawkab.dev",
      passwordHash: password,
      displayName: "المستكشف",
      role: "USER",
      profile: { create: {} },
      roleGrants: { create: { role: "USER" } },
    },
    update: {},
  });
  console.log(`users ready (admin: ${superAdmin.email})`);
}

async function seedPlanet(): Promise<void> {
  const existing = await prisma.planet.findUnique({ where: { seed: DEMO_SEED } });
  if (existing) {
    console.log(`planet already seeded: ${existing.id}`);
    return;
  }

  console.log(`generating planet from seed "${DEMO_SEED}"…`);
  const engine = SimulationEngine.create(DEMO_SEED);

  const planet = await prisma.planet.create({
    data: {
      name: "كوكب أثير — Aether",
      seed: DEMO_SEED,
      description: "الكوكب التجريبي: عالم حي يعمل بمحرك المحاكاة الحتمي.",
      status: "active",
      config: {
        seed: DEMO_SEED,
        gridWidth: engine.config.gridWidth,
        gridHeight: engine.config.gridHeight,
        seaLevel: engine.config.seaLevel,
        tickDuration: "year",
        snapshotInterval: engine.config.snapshotInterval,
      },
      stats: engine.getStats() as unknown as object,
    },
  });
  const eventDbIds = new Map<string, string>();

  const persistEvent = async (ev: (typeof engine.events)[0]): Promise<void> => {
    const row = await prisma.worldEvent.upsert({
      where: { planetId_key: { planetId: planet.id, key: ev.id } },
      create: {
        planetId: planet.id,
        key: ev.id,
        tick: ev.tick,
        simYear: ev.simYear,
        type: ev.type,
        title: ev.title,
        summary: ev.summary,
        regionIndex: ev.region?.index ?? null,
        lat: ev.region?.lat ?? null,
        lon: ev.region?.lon ?? null,
        actorIds: ev.actorIds,
        contributionId: ev.contributionId,
        confidence: ev.confidence,
        magnitude: ev.magnitude,
        data: ev.data as object,
      },
      update: {},
    });
    eventDbIds.set(ev.id, row.id);
    for (const causeKey of ev.causeIds) {
      const causeDbId = eventDbIds.get(causeKey);
      if (!causeDbId) continue;
      await prisma.causalLink
        .create({ data: { planetId: planet.id, causeEventId: causeDbId, effectEventId: row.id } })
        .catch(() => undefined);
    }
  };

  console.log("persisting genesis history…");
  for (const ev of engine.events) await persistEvent(ev);

  console.log(`fast-forwarding ${FAST_FORWARD_TICKS} years…`);
  for (let i = 0; i < FAST_FORWARD_TICKS; i++) {
    const delta = engine.runTick();
    for (const ev of delta.newEvents) await persistEvent(ev);
    await prisma.simulationTick
      .create({
        data: {
          planetId: planet.id,
          tick: delta.toTick,
          simYear: delta.simYear,
          durationMs: 0,
          eventCount: delta.newEvents.length,
          stats: delta.stats as unknown as object,
        },
      })
      .catch(() => undefined);
    if (i % 20 === 19) console.log(`  tick ${i + 1}/${FAST_FORWARD_TICKS}`);
  }

  console.log("persisting regions…");
  const chunk = 150;
  const indexes = engine.state.cells.map((c) => c.index);
  for (let i = 0; i < indexes.length; i += chunk) {
    const slice = indexes.slice(i, i + chunk);
    await prisma.$transaction(
      slice.map((index) => {
        const r = engine.getRegion(index)!;
        return prisma.planetRegion.create({
          data: {
            planetId: planet.id,
            index,
            x: r.x,
            y: r.y,
            lat: r.lat,
            lon: r.lon,
            elevation: r.elevation,
            temperature: r.temperature,
            moisture: r.moisture,
            biome: r.biome,
            fertility: r.fertility,
            pollution: r.pollution,
            river: r.river,
            isOcean: r.isOcean,
            isVolcanic: r.isVolcanic,
            hasIce: r.hasIce,
            ownerCivKey: r.ownerCivId,
            cityKey: r.cityId,
            population: r.population,
            plantCoverage: r.plantCoverage,
          },
        });
      }),
    );
  }

  console.log("persisting resources…");
  const regionRows = await prisma.planetRegion.findMany({ where: { planetId: planet.id }, select: { id: true, index: true } });
  const regionIdByIndex = new Map(regionRows.map((r) => [r.index, r.id]));
  const resourceRows: Array<{ planetId: string; regionId: string; kind: string; amount: number; renewalRate: number; discovered: boolean; controllingCivKey: string | null }> = [];
  for (const cell of engine.state.cells) {
    const regionId = regionIdByIndex.get(cell.index);
    if (!regionId) continue;
    for (const dep of cell.resources) {
      resourceRows.push({
        planetId: planet.id,
        regionId,
        kind: dep.kind,
        amount: dep.amount,
        renewalRate: dep.renewalRate,
        discovered: dep.discovered,
        controllingCivKey: cell.ownerCivId,
      });
    }
  }
  await prisma.resource.createMany({ data: resourceRows });
  console.log(`  ${resourceRows.length} deposits`);

  console.log("persisting civilizations, cities, species, plants, tech…");
  for (const civ of engine.state.civs.values()) {
    await prisma.civilization.create({
      data: {
        planetId: planet.id,
        key: civ.id,
        name: civ.name,
        color: civ.color,
        foundedTick: civ.foundedTick,
        extinct: civ.extinct,
        government: civ.government,
        techEra: civ.techEra,
        population: Math.round(civ.population),
        territorySize: civ.territory.size,
        military: civ.military,
        stability: civ.stability,
        happiness: civ.happiness,
        health: civ.health,
        education: civ.education,
        economy: civ.economy,
        foodSecurity: civ.foodSecurity,
        aggression: civ.aggression,
        innovation: civ.innovation,
        techKeys: [...civ.techKeys],
        stockpiles: civ.stockpiles as object,
        relations: civ.relations as object,
        memory: civ.memory,
      },
    });
    await prisma.culture.create({
      data: { planetId: planet.id, civKey: civ.id, name: civ.cultureName, values: { tradition: civ.aggression, curiosity: civ.innovation }, influence: civ.education },
    });
    await prisma.language.create({
      data: { planetId: planet.id, civKey: civ.id, name: civ.languageName, family: civ.languageFamily, speakers: Math.round(civ.population) },
    });
  }
  for (const city of engine.state.cities.values()) {
    await prisma.city.create({
      data: {
        planetId: planet.id,
        key: city.id,
        name: city.name,
        civKey: city.civId,
        regionIndex: city.cellIndex,
        lat: engine.grid.lat(city.cellIndex),
        lon: engine.grid.lon(city.cellIndex),
        population: Math.round(city.population),
        foundedTick: city.foundedTick,
        isCapital: city.isCapital,
        health: city.health,
        prosperity: city.prosperity,
      },
    });
  }
  const speciesRows = [...engine.state.species.values()].map((sp) => {
    const pops = engine.state.speciesPops.get(sp.id);
    return {
      planetId: planet.id,
      key: sp.id,
      name: sp.name,
      parentKey: sp.parentId,
      homeBiome: sp.homeBiome,
      traits: sp.traits as object,
      diet: sp.diet,
      preyKeys: sp.preyIds,
      originContributionId: sp.originContributionId,
      globalPopulation: Math.round(pops ? [...pops.values()].reduce((a, b) => a + b, 0) : 0),
      cellCount: pops?.size ?? 0,
      createdTick: sp.createdTick,
      extinct: sp.extinct,
      extinctTick: sp.extinctTick,
    };
  });
  await prisma.species.createMany({ data: speciesRows });
  const plantRows = [...engine.state.plants.values()].map((p) => ({
    planetId: planet.id,
    key: p.id,
    name: p.name,
    biomes: p.biomes,
    traits: p.traits as object,
    originContributionId: p.originContributionId,
    coverage: p.cells.size > 0 ? p.cells.size : p.estimatedCoverage,
    createdTick: p.createdTick,
    extinct: p.extinct,
  }));
  await prisma.plant.createMany({ data: plantRows });
  await prisma.technology.createMany({
    data: engine.state.techTree.map((t) => ({
      planetId: planet.id,
      key: t.key,
      name: t.name,
      era: t.era,
      prereqKeys: t.prereqKeys,
      effects: t.effects as object,
      discoveredBy: [...engine.state.civs.values()].filter((c) => c.techKeys.has(t.key)).map((c) => c.id),
      discoveredTick: null,
    })),
  });
  for (const route of engine.state.tradeRoutes.values()) {
    await prisma.tradeRoute
      .create({
        data: {
          planetId: planet.id,
          key: route.id,
          fromCityKey: route.fromCityId,
          toCityKey: route.toCityId,
          fromCivKey: engine.state.cities.get(route.fromCityId)?.civId ?? "",
          toCivKey: engine.state.cities.get(route.toCityId)?.civId ?? "",
          path: route.path.map((i) => ({ lat: engine.grid.lat(i), lon: engine.grid.lon(i) })),
          goods: route.goods,
          value: route.value,
          risk: route.risk,
          active: route.active,
          createdTick: route.createdTick,
        },
      })
      .catch(() => undefined);
  }
  for (const war of engine.state.wars.values()) {
    await prisma.war
      .create({
        data: {
          planetId: planet.id,
          key: war.id,
          name: war.name,
          attackerCivKey: war.attackerCivId,
          defenderCivKey: war.defenderCivId,
          status: war.status,
          startedTick: war.startedTick,
          endedTick: war.endedTick,
          casualties: Math.round(war.casualties),
          frontCells: [...war.frontCells].map((i) => ({ lat: engine.grid.lat(i), lon: engine.grid.lon(i) })),
          causeSummary: war.causeSummary,
        },
      })
      .catch(() => undefined);
  }
  for (const alliance of engine.state.alliances.values()) {
    await prisma.alliance
      .create({
        data: {
          planetId: planet.id,
          key: alliance.id,
          name: alliance.name,
          memberCivKeys: alliance.memberCivIds,
          status: alliance.status,
          createdTick: alliance.createdTick,
          brokenTick: alliance.brokenTick,
        },
      })
      .catch(() => undefined);
  }

  // biome catalogue
  const { BIOME_COLORS } = await import("@kawkab/simulation");
  const biomeNames: Record<string, [string, string]> = {
    ocean: ["محيط", "Ocean"], coast: ["ساحل", "Coast"], plains: ["سهول", "Plains"],
    rainforest: ["غابات مطيرة", "Rainforest"], temperate_forest: ["غابات معتدلة", "Temperate forest"],
    desert: ["صحراء", "Desert"], mountains: ["جبال", "Mountains"], tundra: ["تندرا", "Tundra"],
    swamp: ["مستنقعات", "Swamp"], steppe: ["سهوب", "Steppe"], volcanic: ["بركانية", "Volcanic"], ice: ["جليدية", "Ice"],
  };
  const counts = new Map<string, number>();
  for (const c of engine.state.cells) counts.set(c.biome, (counts.get(c.biome) ?? 0) + 1);
  for (const [biome, count] of counts) {
    const [nameAr, nameEn] = biomeNames[biome] ?? [biome, biome];
    await prisma.biome.create({
      data: { planetId: planet.id, key: biome, nameAr, nameEn, color: BIOME_COLORS[biome as keyof typeof BIOME_COLORS] ?? "#999", cellCount: count },
    });
  }

  console.log("persisting final snapshot…");
  const snap = engine.snapshotNow();
  await prisma.timelineSnapshot.create({
    data: { planetId: planet.id, tick: snap.tick, simYear: Math.round(snap.simYear), hash: snap.hash, state: snap.data as object },
  });
  await prisma.planet.update({
    where: { id: planet.id },
    data: { tick: engine.state.tick, simYear: Math.round(engine.state.simYear), stats: engine.getStats() as unknown as object },
  });

  const stats = engine.getStats();
  console.log(`planet ready: ${planet.id}`);
  console.log(`  tick=${stats.tick} civs=${stats.civilizations} cities=${stats.cities} species=${stats.species} plants=${stats.plants} events=${engine.events.length}`);
}

async function main(): Promise<void> {
  await seedUsers();
  await seedPlanet();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());

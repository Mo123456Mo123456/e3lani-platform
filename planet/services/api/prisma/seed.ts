/**
 * Database seed: roles, sandbox accounts, biome lookup, and a fully simulated
 * demo planet. The planet's history is produced by the real simulation engine
 * (same code as production) — nothing here is hand-invented.
 *
 *   pnpm --filter @planet/api seed
 *
 * Sandbox credentials (also documented in README):
 *   super admin:  admin@planet.local   / Planet#Admin1
 *   demo user:    explorer@planet.local / Planet#Explorer1
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  createWorld,
  runTicks,
  speciesPopulation,
  type WorldState,
} from "@planet/simulation-models";
import { BiomeType } from "@planet/shared-types";

const prisma = new PrismaClient();

const ROLES = [
  "visitor", "registered", "explorer", "life_maker", "civ_builder",
  "historian", "content_moderator", "simulation_manager", "system_admin", "super_admin",
];

const BIOMES: { name: BiomeType; nameAr: string; habitability: number }[] = [
  { name: BiomeType.Ocean, nameAr: "محيط", habitability: 0 },
  { name: BiomeType.Coast, nameAr: "ساحل", habitability: 0.9 },
  { name: BiomeType.Plains, nameAr: "سهول", habitability: 0.95 },
  { name: BiomeType.Rainforest, nameAr: "غابات مطيرة", habitability: 0.55 },
  { name: BiomeType.TemperateForest, nameAr: "غابات معتدلة", habitability: 0.8 },
  { name: BiomeType.Desert, nameAr: "صحراء", habitability: 0.25 },
  { name: BiomeType.Mountains, nameAr: "جبال", habitability: 0.12 },
  { name: BiomeType.Tundra, nameAr: "تندرا", habitability: 0.15 },
  { name: BiomeType.Swamp, nameAr: "مستنقعات", habitability: 0.4 },
  { name: BiomeType.Steppe, nameAr: "سهوب", habitability: 0.65 },
  { name: BiomeType.Volcanic, nameAr: "أراضٍ بركانية", habitability: 0.08 },
  { name: BiomeType.Ice, nameAr: "جليد", habitability: 0.03 },
];

const PLANET_ID = process.env["SEED_PLANET_ID"] ?? "demo-world";
const PLANET_SEED = Number(process.env["SEED_PLANET_SEED"] ?? 20260730);
const HISTORY_TICKS = Number(process.env["SEED_HISTORY_TICKS"] ?? 1000);
const YEARS_PER_TICK = Number(process.env["SEED_YEARS_PER_TICK"] ?? 5);

async function seedRoles(): Promise<void> {
  for (const name of ROLES) {
    await prisma.role.upsert({ where: { name }, create: { name }, update: {} });
  }
  for (const b of BIOMES) {
    await prisma.biome.upsert({
      where: { name: b.name },
      create: { name: b.name, nameAr: b.nameAr, habitability: b.habitability },
      update: { nameAr: b.nameAr, habitability: b.habitability },
    });
  }
  console.log(`roles: ${ROLES.length}, biomes: ${BIOMES.length}`);
}

async function seedUsers(): Promise<void> {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "super_admin" } });
  const userRole = await prisma.role.findUniqueOrThrow({ where: { name: "explorer" } });

  await prisma.user.upsert({
    where: { email: "admin@planet.local" },
    create: {
      email: "admin@planet.local",
      passwordHash: await bcrypt.hash("Planet#Admin1", 12),
      roleId: adminRole.id,
      profile: { create: { displayName: "مدير النظام", locale: "ar" } },
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: "explorer@planet.local" },
    create: {
      email: "explorer@planet.local",
      passwordHash: await bcrypt.hash("Planet#Explorer1", 12),
      roleId: userRole.id,
      profile: { create: { displayName: "مستكشف تجريبي", locale: "ar" } },
    },
    update: {},
  });
  console.log("sandbox users ready");
}

async function seedPlanet(): Promise<void> {
  const existing = await prisma.planet.findUnique({ where: { id: PLANET_ID } });
  if (existing) {
    console.log(`planet ${PLANET_ID} already seeded (tick ${existing.currentTick}) — skipping`);
    return;
  }

  console.log(`generating planet ${PLANET_ID} (seed ${PLANET_SEED})…`);
  const started = Date.now();
  const world = createWorld({
    worldId: PLANET_ID,
    name: "أوريليا — Aurelia",
    seed: PLANET_SEED,
    yearsPerTick: YEARS_PER_TICK,
    plantSpecies: 800,
    animalSpecies: 300,
    civilizations: 12,
    depositCount: 120,
  });

  console.log("running initial history…");
  const tickBatch = 40;
  for (let done = 0; done < HISTORY_TICKS; done += tickBatch) {
    runTicks(world, Math.min(tickBatch, HISTORY_TICKS - done));
    process.stdout.write(`  tick ${world.tick}/${HISTORY_TICKS}\r`);
  }
  console.log(`\nhistory done: ${world.events.length} events in ${Date.now() - started}ms`);

  await prisma.planet.create({
    data: {
      id: PLANET_ID,
      name: world.name,
      seed: PLANET_SEED,
      status: "running",
      currentTick: world.tick,
      yearsPerTick: world.yearsPerTick,
      era: world.era,
      gridWidth: world.grid.width,
      gridHeight: world.grid.height,
      config: { oceanRatio: 0.62, plateCount: 12 },
    },
  });

  await persistWorld(world);
  console.log(`planet persisted in ${Date.now() - started}ms`);
}

async function persistWorld(world: WorldState): Promise<void> {
  const g = world.grid;
  const biomeNames = [
    "ocean", "coast", "plains", "rainforest", "temperate_forest", "desert",
    "mountains", "tundra", "swamp", "steppe", "volcanic", "ice",
  ];

  // Regions (all cells).
  const regionBatch: object[] = [];
  for (let i = 0; i < g.cellCount; i++) {
    regionBatch.push({
      planetId: world.id,
      cellIndex: i,
      lat: (0.5 - Math.floor(i / g.width) / g.height) * 180,
      lon: (i % g.width) / g.width * 360 - 180,
      biome: biomeNames[g.biome[i] ?? 0],
      height: g.elevation[i] ?? 0,
      temperature: g.temperature[i] ?? 0,
      moisture: g.moisture[i] ?? 0,
      pollution: g.pollution[i] ?? 0,
      fertility: g.fertility[i] ?? 0,
      river: (g.river[i] ?? 0) === 1,
    });
  }
  await chunked(regionBatch, (rows) => prisma.planetRegion.createMany({ data: rows as never[], skipDuplicates: true }));

  // Species split into fauna/flora tables.
  const flora = world.species.filter((s) => s.kind === "flora");
  const fauna = world.species.filter((s) => s.kind === "fauna");
  await chunked(flora, (rows) =>
    prisma.plant.createMany({
      data: rows.map((s) => ({
        planetId: world.id,
        engineId: s.id,
        name: s.name,
        population: speciesPopulation(s),
        extinct: s.extinct,
        bornTick: s.bornTick,
        cells: s.cells,
        pollutionAbsorption: s.pollutionAbsorption,
        nightLuminosity: s.nightLuminosity,
        contributionId: s.contributionId,
      })),
      skipDuplicates: true,
    }),
  );
  await chunked(fauna, (rows) =>
    prisma.species.createMany({
      data: rows.map((s) => ({
        planetId: world.id,
        engineId: s.id,
        name: s.name,
        kind: s.diet,
        population: speciesPopulation(s),
        extinct: s.extinct,
        bornTick: s.bornTick,
        cells: s.cells,
        intelligence: s.intelligence,
        aggression: s.aggression,
        contributionId: s.contributionId,
      })),
      skipDuplicates: true,
    }),
  );

  await chunked(world.deposits, (rows) =>
    prisma.resource.createMany({
      data: rows.map((d) => ({
        planetId: world.id,
        engineId: d.id,
        cell: d.cell,
        kind: d.kind,
        quantity: d.quantity,
        regenRate: d.regenRate,
        extractionRate: d.extractionRate,
        value: d.value,
        discoveredBy: d.discoveredBy,
        depleted: d.depleted,
      })),
      skipDuplicates: true,
    }),
  );

  await chunked(world.civs, (rows) =>
    prisma.civilization.createMany({
      data: rows.map((c) => ({
        planetId: world.id,
        engineId: c.id,
        name: c.name,
        population: c.population,
        techLevel: c.techLevel,
        government: c.government,
        military: c.military,
        economy: c.economy,
        stability: c.stability,
        happiness: c.happiness,
        education: c.education,
        health: c.health,
        culture: c.culture,
        language: c.language,
        religion: c.religion,
        fallen: c.fallen,
        capitalCell: c.capitalCell,
        cells: c.cells,
        foundedTick: c.foundedTick,
        contributionId: c.contributionId,
      })),
      skipDuplicates: true,
    }),
  );

  for (const city of world.cities) {
    const civRow = await prisma.civilization.findUnique({
      where: { planetId_engineId: { planetId: world.id, engineId: city.civId } },
      select: { id: true },
    });
    await prisma.city.upsert({
      where: { planetId_engineId: { planetId: world.id, engineId: city.id } },
      create: {
        planetId: world.id,
        engineId: city.id,
        civilizationId: civRow?.id,
        civEngineId: city.civId,
        name: city.name,
        cell: city.cell,
        population: city.population,
        fallen: city.fallen,
        foundedTick: city.foundedTick,
      },
      update: { population: city.population, fallen: city.fallen },
    });
  }

  await chunked(world.techs, (rows) =>
    prisma.technology.createMany({
      data: rows.map((t) => ({
        planetId: world.id,
        engineId: t.id,
        name: t.name,
        tier: t.tier,
        discoveredBy: t.discoveredBy,
        discoveredTick: t.discoveredTick,
        contributionId: t.contributionId,
      })),
      skipDuplicates: true,
    }),
  );

  const cultures = [...new Set(world.civs.map((c) => c.culture))];
  await chunked(cultures, (rows) =>
    prisma.culture.createMany({
      data: rows.map((name) => ({ planetId: world.id, name, traits: {} })),
      skipDuplicates: true,
    }),
  );
  const languages = [...new Set(world.civs.map((c) => c.language))];
  await chunked(languages, (rows) =>
    prisma.language.createMany({
      data: rows.map((name) => ({ planetId: world.id, name, family: "" })),
      skipDuplicates: true,
    }),
  );

  await chunked(world.wars, (rows) =>
    prisma.war.createMany({
      data: rows.map((w) => ({
        planetId: world.id,
        engineId: w.id,
        attackerEngineId: w.attacker,
        defenderEngineId: w.defender,
        startedTick: w.startedTick,
        endedTick: w.endedTick,
        casualties: w.casualties,
        reason: w.reason,
        contributionId: w.contributionId,
      })),
      skipDuplicates: true,
    }),
  );

  await chunked(world.alliances, (rows) =>
    prisma.alliance.createMany({
      data: rows.map((a) => ({
        planetId: world.id,
        engineId: a.id,
        civIds: a.civIds,
        createdTick: a.createdTick,
        brokenTick: a.brokenTick,
      })),
      skipDuplicates: true,
    }),
  );

  await chunked(world.tradeRoutes, (rows) =>
    prisma.tradeRoute.createMany({
      data: rows.map((r) => ({
        planetId: world.id,
        engineId: r.id,
        fromCityEngineId: r.fromCity,
        toCityEngineId: r.toCity,
        path: r.path,
        volume: r.volume,
        active: r.active,
        createdTick: r.createdTick,
      })),
      skipDuplicates: true,
    }),
  );

  await chunked(world.diseases, (rows) =>
    prisma.disease.createMany({
      data: rows.map((d) => ({
        planetId: world.id,
        engineId: d.id,
        name: d.name,
        virulence: d.virulence,
        lethality: d.lethality,
        active: d.active,
        startedTick: d.startedTick,
        contributionId: d.contributionId,
      })),
      skipDuplicates: true,
    }),
  );

  await chunked(world.migrations, (rows) =>
    prisma.migration.createMany({
      data: rows.map((m) => ({
        planetId: world.id,
        engineId: m.id,
        civEngineId: m.civId,
        fromCell: m.fromCell,
        toCell: m.toCell,
        path: m.path,
        people: m.people,
        reason: m.reason,
        startedTick: m.startedTick,
        done: m.done,
      })),
      skipDuplicates: true,
    }),
  );

  // Full event log + causal links.
  await chunked(world.events, (rows) =>
    prisma.worldEvent.createMany({
      data: rows.map((e) => ({
        planetId: world.id,
        seq: e.seq,
        tick: e.tick,
        year: e.year,
        type: String(e.type),
        cellIndex: e.cellIndex ?? null,
        civIds: e.civIds ?? [],
        payload: e.payload as Prisma.InputJsonValue,
        causes: e.causes,
        confidence: e.confidence,
        contributionId: e.contributionId ?? null,
        importance: e.importance,
        hash: e.hash,
      })),
      skipDuplicates: true,
    }),
  );
  const links = world.events.flatMap((e) => e.causes.map((c) => ({ planetId: world.id, fromSeq: c, toSeq: e.seq })));
  await chunked(links, (rows) => prisma.causalLink.createMany({ data: rows, skipDuplicates: true }));

  // Timeline snapshots every 20 ticks.
  for (let tick = 0; tick <= world.tick; tick += 20) {
    await prisma.timelineSnapshot.upsert({
      where: { planetId_tick: { planetId: world.id, tick } },
      create: {
        planetId: world.id,
        tick,
        year: tick * world.yearsPerTick,
        checksum: world.events.find((e) => e.tick >= tick)?.hash ?? "genesis",
        state: {
          stats: {
            civs: world.civs.filter((c) => !c.fallen && c.foundedTick <= tick).length,
            events: world.events.filter((e) => e.tick <= tick).length,
          },
        },
      },
      update: {},
    });
  }
}

async function chunked<T>(rows: T[], fn: (rows: T[]) => Promise<unknown>, size = 500): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}

async function main(): Promise<void> {
  await seedRoles();
  await seedUsers();
  await seedPlanet();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

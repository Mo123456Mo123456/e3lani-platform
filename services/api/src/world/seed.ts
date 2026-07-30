/**
 * Demo planet seed — "كوكب التكوين الأول".
 *
 * Not fixtures: the demo world is produced by the real engine — genesis with
 * 12 civilizations, 300 species, 800 plants, 50 technologies and ~140
 * resource deposits, then ~400 ticks (2000 years) of simulated history
 * (wars, alliances, migrations, extinctions, discoveries) recorded as
 * replayable events with snapshots every 25 ticks.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm seed          # into PostgreSQL
 *   pnpm seed                                       # into data/seed-planet.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SimulationEngine, type EngineConfig } from "@planet/simulation-models";
import { snapshotRecordOf } from "../store/memory.js";
import { PgRepository } from "../store/pg.js";
import { runMigrations } from "../store/migrate.js";
import { seedSandboxAccounts } from "./bootstrap.js";

export const DEMO_ENGINE_CONFIG: Partial<EngineConfig> = {
  seed: "planet-genesis-prime",
  yearsPerTick: 5,
  snapshotInterval: 25,
  initialCivilizations: 12,
  initialSpecies: 300,
  initialPlants: 800,
  initialTechs: 50,
  worldgen: { latBands: 48, lonBands: 96, resourceDensity: 0.1, riverCount: 30 },
};

export const DEMO_HISTORY_TICKS = 400;

export function buildDemoPlanet(ticks = DEMO_HISTORY_TICKS): SimulationEngine {
  const engine = SimulationEngine.genesis({
    ...DEMO_ENGINE_CONFIG,
    planetId: "planet-prime",
  } as EngineConfig);
  console.log(`[seed] genesis done: ${engine.journal.length} events; fast-forwarding ${ticks} ticks...`);
  const started = Date.now();
  engine.run(ticks);
  console.log(`[seed] ${ticks} ticks in ${Date.now() - started}ms; journal=${engine.journal.length} events`);
  return engine;
}

async function seedToPostgres(databaseUrl: string): Promise<void> {
  await runMigrations(databaseUrl);
  const repository = new PgRepository(databaseUrl);
  await seedSandboxAccounts(repository);

  const existing = await repository.listPlanets();
  if (existing.some((p) => p.id === "planet-prime")) {
    console.log("[seed] planet-prime already exists — skipping (drop it first to reseed)");
    await repository.close();
    return;
  }

  const engine = buildDemoPlanet();
  await repository.createPlanet({
    id: "planet-prime",
    name: "كوكب التكوين الأول",
    seed: engine.config.seed,
    latBands: engine.state.grid.latBands,
    lonBands: engine.state.grid.lonBands,
    seaLevel: engine.state.grid.seaLevel,
    currentTick: engine.state.tick,
    currentYear: engine.state.year,
    yearsPerTick: engine.state.yearsPerTick,
    status: "paused",
    stats: engine.stats(),
    createdAt: new Date().toISOString(),
  });

  console.log(`[seed] writing ${engine.journal.length} events...`);
  const BATCH = 500;
  for (let i = 0; i < engine.journal.length; i += BATCH) {
    await repository.appendEvents(engine.journal.slice(i, i + BATCH));
  }
  for (const tick of engine.availableSnapshots()) {
    const state = engine.getSnapshot(tick);
    if (state) await repository.saveSnapshot(snapshotRecordOf("planet-prime", state));
  }
  console.log("[seed] done. Stats:", JSON.stringify(engine.stats(), null, 2));
  await repository.close();
}

function seedToFile(): void {
  const engine = buildDemoPlanet(240);
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "..", "..", "data");
  mkdirSync(dir, { recursive: true });
  const snapshots = engine.availableSnapshots().map((tick) => snapshotRecordOf("planet-prime", engine.getSnapshot(tick)!));
  writeFileSync(
    join(dir, "seed-planet.json"),
    JSON.stringify({
      planet: {
        id: "planet-prime",
        name: "كوكب التكوين الأول",
        seed: engine.config.seed,
        latBands: engine.state.grid.latBands,
        lonBands: engine.state.grid.lonBands,
        seaLevel: engine.state.grid.seaLevel,
        currentTick: engine.state.tick,
        currentYear: engine.state.year,
        yearsPerTick: engine.state.yearsPerTick,
        status: "paused",
        stats: engine.stats(),
        createdAt: new Date().toISOString(),
      },
      events: engine.journal,
      snapshots,
    }),
  );
  console.log(`[seed] wrote ${join(dir, "seed-planet.json")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.DATABASE_URL;
  if (url) {
    await seedToPostgres(url);
  } else {
    seedToFile();
  }
}

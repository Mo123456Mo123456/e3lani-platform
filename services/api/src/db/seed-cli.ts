/**
 * Seed: roles, sandbox accounts, and a fully simulated demo planet.
 *
 *   pnpm --filter @planet/api db:seed
 *
 * Requires DATABASE_URL and a running simulation engine
 * (SIMULATION_ENGINE_URL, default http://localhost:8001).
 * Sandbox credentials come from env (defaults documented in README only).
 */
import bcrypt from "bcryptjs";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { runMigrations } from "./migrate";
import type { Database } from "./kysely.types";
import { EngineClient, type EngineEvent, type EngineState } from "../simulation/engine-client.service";
import { materializeState } from "../simulation/materializer";
import { summarizeState } from "../simulation/simulation.service";

const BIOME_CATALOG: Array<{ name: string; palette: number[]; vegetation_capacity: number }> = [
  { name: "ocean", palette: [18, 46, 92], vegetation_capacity: 0 },
  { name: "coast", palette: [42, 84, 140], vegetation_capacity: 0 },
  { name: "plains", palette: [126, 148, 74], vegetation_capacity: 0.5 },
  { name: "grassland", palette: [110, 156, 82], vegetation_capacity: 0.55 },
  { name: "savanna", palette: [176, 164, 92], vegetation_capacity: 0.45 },
  { name: "rainforest", palette: [22, 102, 52], vegetation_capacity: 0.95 },
  { name: "temperate_forest", palette: [46, 122, 62], vegetation_capacity: 0.7 },
  { name: "boreal_forest", palette: [38, 92, 74], vegetation_capacity: 0.5 },
  { name: "desert", palette: [206, 182, 122], vegetation_capacity: 0.06 },
  { name: "steppe", palette: [158, 152, 100], vegetation_capacity: 0.3 },
  { name: "tundra", palette: [146, 158, 150], vegetation_capacity: 0.15 },
  { name: "ice", palette: [232, 240, 246], vegetation_capacity: 0.02 },
  { name: "mountain", palette: [128, 118, 108], vegetation_capacity: 0.2 },
  { name: "volcanic", palette: [96, 58, 48], vegetation_capacity: 0.1 },
  { name: "swamp", palette: [76, 104, 76], vegetation_capacity: 0.65 },
];

const SEED_TICKS = Number(process.env.SEED_TICKS ?? 180);
const SNAPSHOT_EVERY = 25;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString: databaseUrl, max: 6 }) }),
  });
  const engine = new EngineClient();

  console.log("> running migrations");
  const applied = await runMigrations(databaseUrl);
  console.log(`  ${applied.length ? `applied ${applied.length}` : "up to date"}`);

  console.log("> seeding biome catalog");
  for (const biome of BIOME_CATALOG) {
    await db
      .insertInto("biomes")
      .values({ name: biome.name, palette: biome.palette, vegetation_capacity: biome.vegetation_capacity })
      .onConflict((oc) => oc.column("name").doUpdateSet({ palette: biome.palette, vegetation_capacity: biome.vegetation_capacity }))
      .execute();
  }

  console.log("> seeding sandbox accounts");
  const adminId = await upsertUser(db, {
    email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@planet.local",
    password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "PlanetAdmin!234",
    displayName: "Super Admin",
    role: "super_admin",
  });
  const demoId = await upsertUser(db, {
    email: process.env.SEED_DEMO_USER_EMAIL ?? "demo@planet.local",
    password: process.env.SEED_DEMO_USER_PASSWORD ?? "PlanetDemo!234",
    displayName: "مستكشف تجريبي",
    role: "user",
  });
  console.log(`  admin=${adminId} demo=${demoId}`);

  const existingPlanet = await db.selectFrom("planets").select("id").limit(1).executeTakeFirst();
  if (existingPlanet) {
    console.log(`> planet already exists (${existingPlanet.id}) — skipping world generation`);
    await db.destroy();
    return;
  }

  const seed = Number(process.env.SIM_DEFAULT_SEED ?? 42);
  console.log(`> generating planet (seed=${seed}) — full-scale procedural world`);
  const gen = await engine.generate(seed);
  const state = gen.state;
  const planet = await db
    .insertInto("planets")
    .values({
      name: "أورورا — Aurora",
      seed,
      status: "paused",
      tick: 0,
      years_per_tick: 1,
      grid: state.grid,
      current_state: state as never,
      state_hash: gen.hash,
      created_by: adminId,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  console.log(`  planet id: ${planet.id}`);
  await persistEvents(db, planet.id, gen.events);
  await createSnapshot(db, planet.id, 0, state, gen.hash);

  console.log(`> pre-rolling ${SEED_TICKS} years of history (this takes a while)`);
  let current = state;
  for (let t = 0; t < SEED_TICKS; t += SNAPSHOT_EVERY) {
    const chunk = Math.min(SNAPSHOT_EVERY, SEED_TICKS - t);
    const started = Date.now();
    const result = await engine.advance(current, chunk);
    current = result.state;
    await persistEvents(db, planet.id, result.events);
    await createSnapshot(db, planet.id, current.meta.tick, current, result.hash);
    console.log(
      `  tick ${current.meta.tick}/${SEED_TICKS} — ${result.events.length} events, ${Date.now() - started}ms`,
    );
  }

  console.log("> persisting final state + materializing read models");
  await db
    .updateTable("planets")
    .set({ current_state: current as never, tick: current.meta.tick, state_hash: null })
    .where("id", "=", planet.id)
    .execute();
  await materializeState(db, planet.id, current, current.meta.tick);

  console.log("> rendering map layers");
  const { layers, tick } = await engine.maps(current);
  for (const [layer, base64] of Object.entries(layers)) {
    await db
      .insertInto("planet_map_layers")
      .values({ planet_id: planet.id, layer, tick, png: Buffer.from(base64, "base64") })
      .onConflict((oc) => oc.columns(["planet_id", "layer", "tick"]).doNothing())
      .execute();
  }
  await db.updateTable("planets").set({ map_tick: tick }).where("id", "=", planet.id).execute();

  const summary = summarizeState(current);
  console.log("> seed complete:", JSON.stringify(summary));
  await db.destroy();
}

async function upsertUser(
  db: Kysely<Database>,
  input: { email: string; password: string; displayName: string; role: string },
): Promise<string> {
  const existing = await db.selectFrom("users").select("id").where("email", "=", input.email).executeTakeFirst();
  if (existing) return existing.id;
  const hash = await bcrypt.hash(input.password, 10);
  const user = await db
    .insertInto("users")
    .values({ email: input.email, password_hash: hash, display_name: input.displayName, role: input.role })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db.insertInto("profiles").values({ user_id: user.id }).execute();
  await db.insertInto("roles").values({ user_id: user.id, role: input.role }).execute();
  return user.id;
}

async function persistEvents(db: Kysely<Database>, planetId: string, events: EngineEvent[]): Promise<void> {
  if (!events.length) return;
  await db
    .insertInto("world_events")
    .values(
      events.map((e) => ({
        planet_id: planetId,
        id: e.id,
        tick: e.tick,
        type: e.type,
        importance: e.importance,
        cell_id: e.cellId,
        civ_ids: e.civIds ?? [],
        species_ids: e.speciesIds ?? [],
        plant_ids: e.plantIds ?? [],
        cause_event_id: e.causeEventId,
        contribution_id: null,
        confidence: e.confidence,
        payload: e.payload ?? {},
      })),
    )
    .onConflict((oc) => oc.columns(["planet_id", "id"]).doNothing())
    .execute();
  await db
    .insertInto("causal_links")
    .values(
      events.map((e) => ({
        planet_id: planetId,
        event_id: e.id,
        cause_event_id: e.causeEventId,
        contribution_id: null,
      })),
    )
    .onConflict((oc) => oc.columns(["planet_id", "event_id"]).doNothing())
    .execute();
}

async function createSnapshot(
  db: Kysely<Database>,
  planetId: string,
  tick: number,
  state: EngineState,
  hash: string,
): Promise<void> {
  await db
    .insertInto("timeline_snapshots")
    .values({ planet_id: planetId, tick, state: state as never, state_hash: hash, summary: summarizeState(state) })
    .onConflict((oc) => oc.columns(["planet_id", "tick"]).doNothing())
    .execute();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

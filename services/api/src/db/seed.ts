import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { loadConfig } from "@planet/config";
import {
  generateWorld,
  hashWorld,
  advanceTick,
  worldMetrics,
} from "@planet/simulation-models";
import { db, pool } from "./client.js";
import {
  users,
  profiles,
  planets,
  planetRegions,
  worldEvents,
  timelineSnapshots,
  auditLogs,
} from "./schema.js";

async function upsertUser(
  email: string,
  password: string,
  displayName: string,
  role: string,
) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return existing[0];
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, displayName, role, level: role === "super_admin" ? 99 : 7, xp: 2400, locale: "ar" })
    .returning();
  await db.insert(profiles).values({ userId: user!.id }).onConflictDoNothing();
  return user!;
}

async function main() {
  const config = loadConfig();
  console.log("Seeding planet world...");

  const admin = await upsertUser(
    config.SUPER_ADMIN_EMAIL,
    config.SUPER_ADMIN_PASSWORD,
    config.SUPER_ADMIN_NAME,
    "super_admin",
  );
  const explorer = await upsertUser(
    config.DEMO_USER_EMAIL,
    config.DEMO_USER_PASSWORD,
    "مستكشف الكوكب",
    "explorer",
  );

  const existingPlanet = await db.select().from(planets).limit(1);
  if (existingPlanet[0]) {
    console.log("Planet already seeded:", existingPlanet[0].id);
    console.log("Admin:", admin.email);
    console.log("Demo:", explorer.email);
    await pool.end();
    return;
  }

  let state = generateWorld({
    planetId: "pending",
    seed: config.DEFAULT_PLANET_SEED,
    name: "Aetheris",
    nameAr: "أثيريس",
    tickUnit: config.DEFAULT_TICK_UNIT,
    full: true,
  });

  // Advance a few ticks to produce live history
  const advanced = advanceTick(state, 12);
  state = advanced.state;

  const [planet] = await db
    .insert(planets)
    .values({
      name: state.name,
      nameAr: state.nameAr,
      seed: state.seed,
      tick: state.tick,
      year: state.year,
      tickUnit: state.tickUnit,
      status: "running",
      stateJson: state,
    })
    .returning();

  state.planetId = planet!.id;

  // Persist regions
  const regionRows = state.regions.map((r) => ({
    id: `${planet!.id}:${r.id}`,
    planetId: planet!.id,
    name: r.name,
    nameAr: r.nameAr,
    biome: r.biome,
    lat: r.lat,
    lon: r.lon,
    elevation: r.elevation,
    temperature: r.temperature,
    moisture: r.moisture,
    fertility: r.fertility,
    pollution: r.pollution,
    population: r.population,
    data: {
      water: r.water,
      neighbors: r.neighbors,
      simId: r.id,
    },
  }));
  // batch insert
  for (let i = 0; i < regionRows.length; i += 50) {
    await db.insert(planetRegions).values(regionRows.slice(i, i + 50));
  }

  // Persist events
  for (let i = 0; i < state.events.length; i += 50) {
    const chunk = state.events.slice(i, i + 50).map((e) => ({
      id: `${planet!.id}:${e.id}`,
      planetId: planet!.id,
      type: e.type,
      title: e.title,
      titleAr: e.titleAr,
      description: e.description,
      descriptionAr: e.descriptionAr,
      tick: e.tick,
      year: e.year,
      regionId: e.regionId ? `${planet!.id}:${e.regionId}` : null,
      importance: e.importance,
      confidence: e.confidence,
      causes: e.causes,
      effects: e.effects,
      contributionId: null,
      actorIds: e.actorIds,
      payload: e.payload,
    }));
    await db.insert(worldEvents).values(chunk);
  }

  // Snapshot at tick 0 equivalent (bootstrap) and current
  await db.insert(timelineSnapshots).values([
    {
      planetId: planet!.id,
      tick: 0,
      year: state.year - 12,
      label: "Pre-seed baseline",
      labelAr: "خط الأساس قبل البذور",
      stateHash: hashWorld({ ...state, tick: 0 }),
      stateJson: { note: "baseline marker", metrics: worldMetrics(state) },
    },
    {
      planetId: planet!.id,
      tick: state.tick,
      year: state.year,
      label: "Present",
      labelAr: "الحاضر",
      stateHash: hashWorld(state),
      stateJson: state,
    },
  ]);

  // Update planet with corrected planetId inside state
  await db
    .update(planets)
    .set({ stateJson: state, updatedAt: new Date() })
    .where(eq(planets.id, planet!.id));

  await db.insert(auditLogs).values({
    actorId: admin.id,
    action: "seed.completed",
    targetType: "planet",
    targetId: planet!.id,
    meta: {
      civilizations: state.civilizations.length,
      cities: state.cities.length,
      resources: state.resources.length,
      species: state.species.length,
      plants: state.plants.length,
      technologies: state.technologies.length,
      events: state.events.length,
    },
  });

  console.log("✓ Seed complete");
  console.log("Planet:", planet!.id, state.nameAr);
  console.log("Civs:", state.civilizations.length, "Cities:", state.cities.length);
  console.log("Species:", state.species.length, "Plants:", state.plants.length);
  console.log("Resources:", state.resources.length, "Techs:", state.technologies.length);
  console.log("── Sandbox accounts ──");
  console.log(`Super Admin: ${config.SUPER_ADMIN_EMAIL} / ${config.SUPER_ADMIN_PASSWORD}`);
  console.log(`Explorer:    ${config.DEMO_USER_EMAIL} / ${config.DEMO_USER_PASSWORD}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

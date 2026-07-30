import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { DEFAULT_PLANET_SEED } from "@planet/config";
import { advanceTicks, generateWorld } from "@planet/simulation-models";
import { db, pool } from "./client.js";
import * as schema from "./schema.js";
import { persistWorldState } from "../services/world-persistence.js";

async function main() {
  console.log("Seeding planet world...");

  const passwordHash = await bcrypt.hash("PlanetAdmin!23", 10);
  const explorerHash = await bcrypt.hash("Explorer!23", 10);

  const [superAdmin] = await db
    .insert(schema.users)
    .values({
      email: "superadmin@planet.local",
      passwordHash,
      displayName: "Super Admin",
      role: "super_admin",
      level: 99,
      xp: 99999,
      locale: "ar",
    })
    .onConflictDoNothing()
    .returning();

  const existingAdmin = superAdmin
    ? superAdmin
    : (
        await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, "superadmin@planet.local"))
      )[0]!;

  const [explorer] = await db
    .insert(schema.users)
    .values({
      email: "explorer@planet.local",
      passwordHash: explorerHash,
      displayName: "مستكشف كوكب",
      role: "explorer",
      level: 7,
      xp: 4200,
      locale: "ar",
    })
    .onConflictDoNothing()
    .returning();

  const explorerUser =
    explorer ??
    (
      await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, "explorer@planet.local"))
    )[0]!;

  await db
    .insert(schema.profiles)
    .values([
      { userId: existingAdmin.id, bio: "Sandbox Super Admin", impactScore: 0 },
      { userId: explorerUser.id, bio: "مستكشف الكوكب التجريبي", impactScore: 128 },
    ])
    .onConflictDoNothing();

  const existingPlanet = await db.select().from(schema.planets).limit(1);
  if (existingPlanet.length) {
    console.log("Planet already seeded:", existingPlanet[0]!.id);
    await pool.end();
    return;
  }

  const [planet] = await db
    .insert(schema.planets)
    .values({
      name: "كوكب يولد أمامك",
      nameEn: "A Planet Being Born Before You",
      seed: DEFAULT_PLANET_SEED,
      currentTick: 0,
      currentYear: 0,
      tickUnit: "year",
      status: "running",
    })
    .returning();

  let world = generateWorld({
    planetId: planet!.id,
    seed: DEFAULT_PLANET_SEED,
  });

  // bootstrap some history
  const boot = advanceTicks(world, 120);
  world = boot.state;

  await persistWorldState(planet!.id, world, { replace: true });

  await db.insert(schema.timelineSnapshots).values({
    planetId: planet!.id,
    label: "bootstrap_year_120",
    tick: world.tick,
    year: world.year,
    state: world as unknown as Record<string, unknown>,
  });

  await db.insert(schema.auditLogs).values({
    actorId: existingAdmin.id,
    action: "seed.completed",
    target: planet!.id,
    meta: {
      civilizations: world.civilizations.length,
      cities: world.cities.length,
      resources: world.resources.length,
      species: world.species.length,
      plants: world.plants.length,
      technologies: world.technologies.length,
      events: world.eventLog.length,
    },
  });

  console.log("Seed complete.");
  console.log("Planet ID:", planet!.id);
  console.log("Sandbox accounts (see README):");
  console.log("  superadmin@planet.local / PlanetAdmin!23");
  console.log("  explorer@planet.local / Explorer!23");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});

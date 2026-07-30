import { scryptSync } from "node:crypto";

import {
  advanceWorld,
  deterministicUuid,
  generateWorld,
  summarizeWorld,
} from "@planet/simulation-models";

import { connectDatabase } from "./index";
import {
  biomes,
  cities,
  civilizations,
  planetRegions,
  planets,
  plants,
  profiles,
  resources,
  roles,
  species,
  technologies,
  userRoles,
  users,
  worldEvents,
} from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed data");

const world = advanceWorld(
  generateWorld({ seed: "nova-terra-production-seed-v1" }),
  240,
).world;
const summary = summarizeWorld(world);
const connection = connectDatabase(databaseUrl);

const biomeSeed = [
  ["ocean", "محيط", "Ocean", "#0b4f7c"],
  ["coast", "ساحل", "Coast", "#2a8aa0"],
  ["plains", "سهول", "Plains", "#6f9b45"],
  ["rainforest", "غابة مطيرة", "Rainforest", "#176b3a"],
  ["temperate_forest", "غابة معتدلة", "Temperate forest", "#315f39"],
  ["desert", "صحراء", "Desert", "#bf914e"],
  ["mountain", "جبال", "Mountain", "#767b7d"],
  ["tundra", "تندرا", "Tundra", "#9ba8a0"],
  ["wetland", "مستنقعات", "Wetland", "#3f776b"],
  ["steppe", "سهوب", "Steppe", "#9a9a55"],
  ["volcanic", "بركانية", "Volcanic", "#713b32"],
  ["ice", "جليد", "Ice", "#d6eef3"],
] as const;

const sandboxUserId = deterministicUuid("sandbox", "super-admin");
const superAdminRoleId = deterministicUuid("role", "super_admin");

try {
  await connection.db.transaction(async (tx) => {
    await tx
      .insert(biomes)
      .values(
        biomeSeed.map(([id, nameAr, nameEn, color]) => ({
          id,
          nameAr,
          nameEn,
          color,
          constraints: {},
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(roles)
      .values([
        {
          id: deterministicUuid("role", "user"),
          key: "user",
          nameAr: "مستخدم",
          nameEn: "User",
          permissions: ["world:read", "contribution:create"],
        },
        {
          id: superAdminRoleId,
          key: "super_admin",
          nameAr: "مدير النظام",
          nameEn: "Super Admin",
          permissions: ["*"],
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(users)
      .values({
        id: sandboxUserId,
        email: "admin@planet.local",
        passwordHash: hashSandboxPassword("PlanetSandbox!2026"),
        locale: "ar",
      })
      .onConflictDoNothing();
    await tx
      .insert(profiles)
      .values({
        id: deterministicUuid("profile", sandboxUserId),
        userId: sandboxUserId,
        displayName: "مدير العالم التجريبي",
      })
      .onConflictDoNothing();
    await tx
      .insert(userRoles)
      .values({ userId: sandboxUserId, roleId: superAdminRoleId })
      .onConflictDoNothing();

    await tx
      .insert(planets)
      .values({
        id: world.id,
        nameAr: world.nameAr,
        nameEn: world.nameEn,
        seed: world.seed,
        currentTick: world.currentTick,
        currentYear: world.currentYear,
        stateHash: summary.stateHash,
      })
      .onConflictDoNothing();

    await tx
      .insert(planetRegions)
      .values(
        world.regions.map((region) => ({
          id: region.id,
          planetId: world.id,
          biomeId: region.biome,
          regionIndex: region.index,
          nameAr: region.nameAr,
          nameEn: region.nameEn,
          latitude: region.latitude,
          longitude: region.longitude,
          elevation: region.elevation,
          temperature: region.temperature,
          moisture: region.moisture,
          fertility: region.fertility,
          pollution: region.pollution,
          population: region.population,
          resourceRichness: region.resourceRichness,
          cell: { latitude: region.latitude, longitude: region.longitude },
        })),
      )
      .onConflictDoNothing();

    const entityValues = (kind: "species" | "plant" | "resource" | "civilization" | "city") =>
      world.entities.filter((entity) => entity.kind === kind);

    await tx
      .insert(species)
      .values(
        entityValues("species").map((entity) => ({
          id: entity.id,
          planetId: world.id,
          regionId: entity.regionId,
          name: entity.name,
          population: entity.population,
          health: entity.health,
          traits: entity.attributes,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(plants)
      .values(
        entityValues("plant").map((entity) => ({
          id: entity.id,
          planetId: world.id,
          regionId: entity.regionId,
          name: entity.name,
          population: entity.population,
          health: entity.health,
          traits: entity.attributes,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(resources)
      .values(
        entityValues("resource").map((entity) => ({
          id: entity.id,
          planetId: world.id,
          regionId: entity.regionId,
          name: entity.name,
          population: 0,
          health: entity.health,
          traits: entity.attributes,
          quantity: Number(entity.attributes.resilience ?? 0.5) * 1_000_000,
          unitValue: Number(entity.attributes.adaptation ?? 0.5) * 100,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(civilizations)
      .values(
        entityValues("civilization").map((entity) => ({
          id: entity.id,
          planetId: world.id,
          regionId: entity.regionId,
          name: entity.name,
          population: entity.population,
          health: entity.health,
          traits: entity.attributes,
          technologyLevel: Number(entity.attributes.adaptation ?? 0.2),
          stability: Number(entity.attributes.resilience ?? 0.5),
        })),
      )
      .onConflictDoNothing();

    const seededCivilizations = entityValues("civilization");
    await tx
      .insert(cities)
      .values(
        entityValues("city").map((entity, index) => ({
          id: entity.id,
          planetId: world.id,
          regionId: entity.regionId,
          civilizationId:
            seededCivilizations[index % seededCivilizations.length]!.id,
          name: entity.name,
          population: entity.population,
          health: entity.health,
          traits: entity.attributes,
          foodStock: entity.population * 1.2,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(technologies)
      .values(
        Array.from({ length: 50 }, (_, index) => ({
          id: deterministicUuid(world.seed, `technology:${index}`),
          planetId: world.id,
          civilizationId:
            seededCivilizations[index % seededCivilizations.length]!.id,
          name: `technology-${index + 1}`,
          level: 1 + Math.floor(index / 10),
          prerequisites: index === 0 ? [] : [`technology-${index}`],
          effects: { innovation: (index + 1) / 50 },
          discoveredAtTick: index * 10,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(worldEvents)
      .values(
        world.events.map((event) => ({
          id: event.id,
          planetId: event.worldId,
          sequence: event.sequence,
          type: event.type,
          tick: event.tick,
          year: event.year,
          regionId: event.regionId,
          contributionId: event.contributionId,
          cause: event.cause,
          causeEventIds: event.causeEventIds,
          actorIds: event.actorIds,
          payload: event.payload,
          confidence: event.confidence,
          directImpact: event.directImpact,
          occurredAt: new Date(event.createdAt),
        })),
      )
      .onConflictDoNothing();
  });

  console.info(
    `Seeded ${world.nameEn}: ${world.regions.length} regions, 12 civilizations, 40 cities, 120 resources, 300 species, 800 plants, and 50 technologies.`,
  );
} finally {
  await connection.close();
}

function hashSandboxPassword(password: string): string {
  const salt = "planet-sandbox-only";
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

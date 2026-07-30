import { eq } from "drizzle-orm";
import type { WorldState } from "@planet/simulation-models";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";

export async function persistWorldState(
  planetId: string,
  world: WorldState,
  opts?: { replace?: boolean },
) {
  if (opts?.replace) {
    await db.delete(schema.planetRegions).where(eq(schema.planetRegions.planetId, planetId));
    await db.delete(schema.species).where(eq(schema.species.planetId, planetId));
    await db.delete(schema.plants).where(eq(schema.plants.planetId, planetId));
    await db.delete(schema.resources).where(eq(schema.resources.planetId, planetId));
    await db.delete(schema.civilizations).where(eq(schema.civilizations.planetId, planetId));
    await db.delete(schema.cities).where(eq(schema.cities.planetId, planetId));
    await db.delete(schema.technologies).where(eq(schema.technologies.planetId, planetId));
    await db.delete(schema.wars).where(eq(schema.wars.planetId, planetId));
    await db.delete(schema.migrations).where(eq(schema.migrations.planetId, planetId));
    await db.delete(schema.tradeRoutes).where(eq(schema.tradeRoutes.planetId, planetId));
    await db.delete(schema.alliances).where(eq(schema.alliances.planetId, planetId));
    await db.delete(schema.diseases).where(eq(schema.diseases.planetId, planetId));
    await db.delete(schema.worldEvents).where(eq(schema.worldEvents.planetId, planetId));
  }

  // Store compact region sample for queries (full grid in blob). Land + notable cells only would be huge;
  // we persist all regions in chunks.
  const chunk = 500;
  for (let i = 0; i < world.regions.length; i += chunk) {
    const slice = world.regions.slice(i, i + chunk).map((r) => ({
      id: r.id,
      planetId,
      name: r.name,
      nameEn: r.nameEn,
      biome: r.biome,
      lat: r.lat,
      lng: r.lng,
      x: r.x,
      y: r.y,
      elevation: r.elevation,
      temperature: r.temperature,
      moisture: r.moisture,
      fertility: r.fertility,
      pollution: r.pollution,
      population: r.population,
      carryingCapacity: r.carryingCapacity,
      civilizationId: r.civilizationId,
    }));
    await db.insert(schema.planetRegions).values(slice).onConflictDoNothing();
  }

  await db
    .insert(schema.civilizations)
    .values(
      world.civilizations.map((c) => ({
        id: c.id,
        planetId,
        name: c.name,
        nameEn: c.nameEn,
        population: c.population,
        stats: {
          techLevel: c.techLevel,
          military: c.military,
          economy: c.economy,
          food: c.food,
          stability: c.stability,
          aggression: c.aggression,
          innovation: c.innovation,
          happiness: c.happiness,
          pollution: c.pollution,
          education: c.education,
        },
        capitalRegionId: c.capitalRegionId,
        memory: c.memory,
        contributionId: c.contributionId as unknown as string | undefined,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.cities)
    .values(
      world.cities.map((c) => ({
        id: c.id,
        planetId,
        civilizationId: c.civilizationId,
        regionId: c.regionId,
        name: c.name,
        nameEn: c.nameEn,
        population: c.population,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.resources)
    .values(
      world.resources.map((r) => ({
        id: r.id,
        planetId,
        regionId: r.regionId,
        name: r.name,
        nameEn: r.nameEn,
        quantity: r.quantity,
        value: r.value,
        renewal: r.renewal,
      })),
    )
    .onConflictDoNothing();

  // Persist a representative subset of species/plants for SQL queries; full lists in blob.
  await db
    .insert(schema.species)
    .values(
      world.species.slice(0, 300).map((s) => ({
        id: s.id,
        planetId,
        name: s.name,
        nameEn: s.nameEn,
        population: s.population,
        traits: {
          size: s.size,
          reproduction: s.reproduction,
          aggression: s.aggression,
          intelligence: s.intelligence,
        },
        preferredBiomes: s.preferredBiomes,
        contributionId: s.contributionId as unknown as string | undefined,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.plants)
    .values(
      world.plants.slice(0, 800).map((p) => ({
        id: p.id,
        planetId,
        name: p.name,
        nameEn: p.nameEn,
        coverage: p.coverage,
        traits: {
          growthRate: p.growthRate,
          waterNeed: p.waterNeed,
          pollutionAbsorption: p.pollutionAbsorption,
          luminosity: p.luminosity,
        },
        preferredBiomes: p.preferredBiomes,
        contributionId: p.contributionId as unknown as string | undefined,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.technologies)
    .values(
      world.technologies.map((t) => ({
        id: t.id,
        planetId,
        name: t.name,
        nameEn: t.nameEn,
        level: t.level,
        civilizationIds: t.civilizationIds,
        contributionId: t.contributionId as unknown as string | undefined,
      })),
    )
    .onConflictDoNothing();

  if (world.wars.length) {
    await db
      .insert(schema.wars)
      .values(
        world.wars.map((w) => ({
          id: w.id,
          planetId,
          aId: w.aId,
          bId: w.bId,
          regionId: w.regionId,
          active: w.active,
          startedTick: w.startedTick,
          strength: w.strength,
        })),
      )
      .onConflictDoNothing();
  }

  if (world.migrations.length) {
    await db
      .insert(schema.migrations)
      .values(
        world.migrations.map((m) => ({
          id: m.id,
          planetId,
          fromRegionId: m.fromRegionId,
          toRegionId: m.toRegionId,
          population: m.population,
          active: m.active,
          reason: m.reason,
          startedTick: m.startedTick,
        })),
      )
      .onConflictDoNothing();
  }

  if (world.tradeRoutes.length) {
    await db
      .insert(schema.tradeRoutes)
      .values(
        world.tradeRoutes.map((t) => ({
          id: t.id,
          planetId,
          fromCityId: t.fromCityId,
          toCityId: t.toCityId,
          risk: t.risk,
          value: t.value,
        })),
      )
      .onConflictDoNothing();
  }

  if (world.alliances.length) {
    await db
      .insert(schema.alliances)
      .values(
        world.alliances.map((a) => ({
          id: a.id,
          planetId,
          aId: a.aId,
          bId: a.bId,
          formedTick: a.formedTick,
        })),
      )
      .onConflictDoNothing();
  }

  if (world.diseases.length) {
    await db
      .insert(schema.diseases)
      .values(
        world.diseases.map((d) => ({
          id: d.id,
          planetId,
          name: d.name,
          infectivity: d.infectivity,
          severity: d.severity,
          regionIds: d.regionIds,
        })),
      )
      .onConflictDoNothing();
  }

  const recentEvents = world.eventLog.slice(-200);
  if (recentEvents.length) {
    await db
      .insert(schema.worldEvents)
      .values(
        recentEvents.map((e) => ({
          id: e.id,
          planetId,
          type: e.type,
          title: e.title,
          titleEn: e.titleEn,
          summary: e.summary,
          summaryEn: e.summaryEn,
          tick: e.tick,
          year: e.year,
          importance: e.importance,
          regionId: e.regionId,
          lat: e.lat,
          lng: e.lng,
          causes: e.causes,
          effects: e.effects,
          contributionId: e.contributionId as unknown as string | undefined,
          userId: e.userId as unknown as string | undefined,
          confidence: e.confidence,
        })),
      )
      .onConflictDoNothing();
  }

  await db
    .insert(schema.worldStateBlobs)
    .values({
      planetId,
      state: world as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.worldStateBlobs.planetId,
      set: {
        state: world as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });

  await db
    .update(schema.planets)
    .set({
      currentTick: world.tick,
      currentYear: world.year,
    })
    .where(eq(schema.planets.id, planetId));
}

export async function loadWorldState(planetId: string): Promise<WorldState | null> {
  const rows = await db
    .select()
    .from(schema.worldStateBlobs)
    .where(eq(schema.worldStateBlobs.planetId, planetId))
    .limit(1);
  if (!rows[0]) return null;
  return rows[0].state as unknown as WorldState;
}

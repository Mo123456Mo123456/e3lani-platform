import { desc, eq, and, ne } from "drizzle-orm";
import {
  advanceTick,
  applyContribution,
  cloneWorld,
  hashWorld,
  runFutureScenarios,
  worldMetrics,
  type WorldState,
} from "@planet/simulation-models";
import type { StructuredContribution as SC } from "@planet/shared-types";
import { db } from "../db/client.js";
import {
  planets,
  planetRegions,
  worldEvents,
  causalLinks,
  timelineSnapshots,
  simulationTicks,
  userContributions,
  notifications,
  profiles,
  aiRequests,
} from "../db/schema.js";
import { narrateFromEvents } from "../lib/ai-client.js";

export async function getPrimaryPlanet() {
  const rows = await db.select().from(planets).limit(1);
  return rows[0] ?? null;
}

export function asWorldState(planet: typeof planets.$inferSelect): WorldState {
  return planet.stateJson as WorldState;
}

export async function getPlanetSummary(planetId: string) {
  const [planet] = await db.select().from(planets).where(eq(planets.id, planetId)).limit(1);
  if (!planet) return null;
  const state = asWorldState(planet);
  const metrics = worldMetrics(state);
  return {
    id: planet.id,
    name: planet.name,
    nameAr: planet.nameAr,
    seed: planet.seed,
    ageYears: planet.year,
    tick: planet.tick,
    tickUnit: planet.tickUnit,
    status: planet.status,
    ...metrics,
  };
}

export async function listRegions(planetId: string) {
  return db.select().from(planetRegions).where(eq(planetRegions.planetId, planetId));
}

export async function getRegion(planetId: string, regionKey: string) {
  const id = regionKey.includes(":") ? regionKey : `${planetId}:${regionKey}`;
  const rows = await db.select().from(planetRegions).where(eq(planetRegions.id, id)).limit(1);
  if (rows[0]) return rows[0];
  // fallback sim id
  const all = await db.select().from(planetRegions).where(eq(planetRegions.planetId, planetId));
  return all.find((r) => (r.data as { simId?: string }).simId === regionKey) ?? null;
}

export async function listEvents(planetId: string, limit = 40) {
  return db
    .select()
    .from(worldEvents)
    .where(and(eq(worldEvents.planetId, planetId), ne(worldEvents.type, "TICK_COMPLETED")))
    .orderBy(desc(worldEvents.importance), desc(worldEvents.createdAt))
    .limit(limit);
}

export async function persistWorld(
  planetId: string,
  state: WorldState,
  newEvents: WorldState["events"],
  newLinks: WorldState["causalLinks"],
) {
  state.planetId = planetId;
  await db
    .update(planets)
    .set({
      tick: state.tick,
      year: state.year,
      stateJson: state,
      updatedAt: new Date(),
    })
    .where(eq(planets.id, planetId));

  // sync region vitals
  for (const r of state.regions) {
    await db
      .update(planetRegions)
      .set({
        temperature: r.temperature,
        moisture: r.moisture,
        fertility: r.fertility,
        pollution: r.pollution,
        population: r.population,
      })
      .where(eq(planetRegions.id, `${planetId}:${r.id}`));
  }

  for (const e of newEvents) {
    await db
      .insert(worldEvents)
      .values({
        id: `${planetId}:${e.id}`,
        planetId,
        type: e.type,
        title: e.title,
        titleAr: e.titleAr,
        description: e.description,
        descriptionAr: e.descriptionAr,
        tick: e.tick,
        year: e.year,
        regionId: e.regionId ? `${planetId}:${e.regionId}` : null,
        importance: e.importance,
        confidence: e.confidence,
        causes: e.causes,
        effects: e.effects,
        contributionId: e.contributionId ?? null,
        actorIds: e.actorIds,
        payload: e.payload,
      })
      .onConflictDoNothing();
  }

  for (const l of newLinks) {
    await db
      .insert(causalLinks)
      .values({
        id: `${planetId}:${l.id}`,
        planetId,
        fromEventId: `${planetId}:${l.fromEventId}`,
        toEventId: `${planetId}:${l.toEventId}`,
        relation: l.relation,
        strength: l.strength,
        description: l.description,
        descriptionAr: l.descriptionAr,
      })
      .onConflictDoNothing();
  }
}

export async function runTicks(planetId: string, steps: number) {
  const [planet] = await db.select().from(planets).where(eq(planets.id, planetId)).limit(1);
  if (!planet) throw new Error("Planet not found");
  if (planet.status !== "running") throw new Error("Simulation paused");

  const started = Date.now();
  const state = asWorldState(planet);
  const result = advanceTick(state, steps);
  await persistWorld(planetId, result.state, result.newEvents, result.newLinks);

  await db.insert(simulationTicks).values({
    planetId,
    tick: result.state.tick,
    year: result.state.year,
    eventCount: result.newEvents.length,
    metrics: result.metrics,
    durationMs: Date.now() - started,
  });

  // Snapshot every 5 ticks
  if (result.state.tick % 5 === 0) {
    await db.insert(timelineSnapshots).values({
      planetId,
      tick: result.state.tick,
      year: result.state.year,
      label: `Tick ${result.state.tick}`,
      labelAr: `نبضة ${result.state.tick}`,
      stateHash: hashWorld(result.state),
      stateJson: result.state,
    });
  }

  // Notify contribution owners of echo events
  for (const e of result.newEvents) {
    if (!e.contributionId) continue;
    const [c] = await db
      .select()
      .from(userContributions)
      .where(eq(userContributions.id, e.contributionId))
      .limit(1);
    if (!c) continue;
    await db.insert(notifications).values({
      userId: c.userId,
      title: e.title,
      titleAr: e.titleAr,
      body: e.description,
      bodyAr: e.descriptionAr,
      kind: "contribution_echo",
      payload: { eventId: e.id, type: e.type },
    });
    await db
      .update(profiles)
      .set({
        totalImpacts: (await getProfileImpacts(c.userId)) + 1,
      })
      .where(eq(profiles.userId, c.userId));
  }

  return result;
}

async function getProfileImpacts(userId: string) {
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return p?.totalImpacts ?? 0;
}

export async function applyUserContribution(opts: {
  planetId: string;
  userId: string;
  contributionId: string;
  regionSimId: string;
  structured: SC;
  runForecast: boolean;
}) {
  const [planet] = await db.select().from(planets).where(eq(planets.id, opts.planetId)).limit(1);
  if (!planet) throw new Error("Planet not found");

  // Snapshot before for comparison
  const before = cloneWorld(asWorldState(planet));
  await db.insert(timelineSnapshots).values({
    planetId: opts.planetId,
    tick: before.tick,
    year: before.year,
    label: `Before ${opts.contributionId.slice(0, 8)}`,
    labelAr: `قبل المساهمة`,
    stateHash: hashWorld(before),
    stateJson: before,
  });

  const applied = applyContribution(
    before,
    opts.structured,
    opts.regionSimId,
    opts.userId,
    opts.contributionId,
  );

  // Run a few ticks so effects appear immediately
  const appliedEvents = applied.state.events.filter(
    (e) => e.contributionId === opts.contributionId || e.id.includes(opts.contributionId),
  );
  const advanced = advanceTick(applied.state, 3);
  const echoEvents = advanced.newEvents.filter(
    (e) => e.contributionId === opts.contributionId || e.id.includes(opts.contributionId),
  );
  const related = [...appliedEvents, ...echoEvents];
  await persistWorld(
    opts.planetId,
    advanced.state,
    [...appliedEvents, ...advanced.newEvents],
    advanced.newLinks,
  );
  const story = await narrateFromEvents({
    events: related.length ? related : [applied.event],
    locale: "ar",
  });

  await db.insert(aiRequests).values({
    userId: opts.userId,
    provider: story.provider,
    purpose: "narrate",
    input: { eventIds: related.map((e) => e.id) },
    output: story,
    sandbox: story.sandbox,
    costUsd: 0,
    latencyMs: 0,
  });

  let scenarios = null;
  if (opts.runForecast) {
    scenarios = runFutureScenarios(before, {
      contribution: opts.structured,
      regionId: opts.regionSimId,
      userId: opts.userId,
      contributionId: opts.contributionId,
      horizons: [1, 10, 100],
      samples: 4,
    });
  }

  await db
    .update(userContributions)
    .set({
      status: "applied",
      entityId: applied.entityId,
      appliedTick: applied.state.tick,
      preview: applied.preview,
      narrative: story.narrative,
      narrativeAr: story.narrativeAr,
    })
    .where(eq(userContributions.id, opts.contributionId));

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, opts.userId)).limit(1);
  if (profile) {
    await db
      .update(profiles)
      .set({
        elementsAdded: profile.elementsAdded + 1,
        totalImpacts: profile.totalImpacts + related.length,
      })
      .where(eq(profiles.userId, opts.userId));
  }

  await db.insert(notifications).values({
    userId: opts.userId,
    title: "Your element entered the world",
    titleAr: "عنصرك دخل العالم",
    body: story.narrative,
    bodyAr: story.narrativeAr,
    kind: "contribution_applied",
    payload: { contributionId: opts.contributionId },
  });

  const afterMetrics = worldMetrics(advanced.state);
  const beforeMetrics = worldMetrics(before);

  return {
    entityId: applied.entityId,
    preview: applied.preview,
    narrative: story.narrative,
    narrativeAr: story.narrativeAr,
    events: related,
    scenarios,
    comparison: { before: beforeMetrics, after: afterMetrics },
    sandboxNarrative: story.sandbox,
  };
}

export async function rollbackToSnapshot(planetId: string, snapshotId: string) {
  const [snap] = await db
    .select()
    .from(timelineSnapshots)
    .where(and(eq(timelineSnapshots.id, snapshotId), eq(timelineSnapshots.planetId, planetId)))
    .limit(1);
  if (!snap) throw new Error("Snapshot not found");
  const state = snap.stateJson as WorldState;
  if (!state.regions) throw new Error("Snapshot has no full state");
  await persistWorld(planetId, state, [], []);
  await db
    .update(planets)
    .set({ tick: state.tick, year: state.year, stateJson: state, updatedAt: new Date() })
    .where(eq(planets.id, planetId));
  return state;
}

export async function getCausalGraph(planetId: string, contributionId?: string) {
  const links = await db.select().from(causalLinks).where(eq(causalLinks.planetId, planetId));
  let events = await listEvents(planetId, 200);
  if (contributionId) {
    events = events.filter(
      (e) => e.contributionId === contributionId || links.some((l) => l.fromEventId.includes(contributionId) || l.toEventId.includes(contributionId)),
    );
  }
  return { events, links };
}

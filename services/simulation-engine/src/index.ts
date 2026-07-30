/**
 * Standalone simulation worker (optional horizontal scaler).
 *
 * Single-instance deployments tick inside the API process (WorldManager).
 * Run this worker when you want a dedicated process to advance one or more
 * planets:  WORKER_PLANET_IDS=id1,id2 TICKS_PER_SECOND=2 node dist/index.js
 */
import { PrismaClient } from "@prisma/client";
import { SimulationEngine, type SerializedWorld } from "@kawkab/simulation";

const prisma = new PrismaClient();
const TICKS_PER_SECOND = Number(process.env.TICKS_PER_SECOND ?? 1);

async function loadEngine(planetId: string): Promise<SimulationEngine> {
  const planet = await prisma.planet.findUniqueOrThrow({ where: { id: planetId } });
  const snapshot = await prisma.timelineSnapshot.findFirst({ where: { planetId }, orderBy: { tick: "desc" } });
  return snapshot ? SimulationEngine.fromWorld(snapshot.state as SerializedWorld) : SimulationEngine.create(planet.seed);
}

async function tickPlanet(planetId: string, engine: SimulationEngine, eventDbIds: Map<string, string>): Promise<void> {
  const started = Date.now();
  const delta = engine.runTick();
  delta.planetId = planetId;
  await prisma.simulationTick
    .create({
      data: {
        planetId,
        tick: delta.toTick,
        simYear: delta.simYear,
        durationMs: Date.now() - started,
        eventCount: delta.newEvents.length,
        stats: delta.stats as unknown as object,
      },
    })
    .catch(() => undefined);
  for (const ev of delta.newEvents) {
    const row = await prisma.worldEvent
      .upsert({
        where: { planetId_key: { planetId, key: ev.id } },
        create: {
          planetId,
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
      })
      .catch(() => null);
    if (!row) continue;
    eventDbIds.set(ev.id, row.id);
    for (const causeKey of ev.causeIds) {
      const causeDbId = eventDbIds.get(causeKey)
        ?? (await prisma.worldEvent.findUnique({ where: { planetId_key: { planetId, key: causeKey } }, select: { id: true } }))?.id;
      if (!causeDbId) continue;
      await prisma.causalLink.create({ data: { planetId, causeEventId: causeDbId, effectEventId: row.id } }).catch(() => undefined);
    }
  }
  if (engine.state.tick % engine.config.snapshotInterval === 0) {
    const snap = engine.snapshotNow();
    await prisma.timelineSnapshot
      .upsert({
        where: { planetId_tick: { planetId, tick: snap.tick } },
        create: { planetId, tick: snap.tick, simYear: Math.round(snap.simYear), hash: snap.hash, state: snap.data as object },
        update: { hash: snap.hash, state: snap.data as object },
      })
      .catch(() => undefined);
  }
  if (engine.state.tick % 5 === 0) {
    await prisma.planet
      .update({ where: { id: planetId }, data: { tick: engine.state.tick, simYear: Math.round(engine.state.simYear), stats: delta.stats as unknown as object } })
      .catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const ids = (process.env.WORKER_PLANET_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    console.log("WORKER_PLANET_IDS not set — worker idle. (In-API ticker handles single-instance runs.)");
    return;
  }
  console.log(`simulation worker advancing ${ids.length} planet(s) at ${TICKS_PER_SECOND} tps`);
  const engines = new Map<string, { engine: SimulationEngine; eventDbIds: Map<string, string> }>();
  for (const id of ids) {
    engines.set(id, { engine: await loadEngine(id), eventDbIds: new Map() });
  }
  const interval = Math.max(50, 1000 / TICKS_PER_SECOND);
  setInterval(() => {
    for (const [id, { engine, eventDbIds }] of engines) {
      tickPlanet(id, engine, eventDbIds).catch((err) => console.error(`tick ${id} failed:`, err));
    }
  }, interval);
}

void main();

import { EventEmitter } from "node:events";
import {
  generatePlanet,
  heightMapPreview,
  SimulationEngine,
  type SimEvent,
} from "@planet/simulation-core";
import type { StructuredElement } from "@planet/shared-types";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";

export type BusMessage =
  | { type: "world.event"; payload: SimEvent }
  | {
      type: "simulation.tick";
      payload: { tick: number; year: number; eventsCount: number };
    }
  | {
      type: "contribution.status";
      payload: {
        contributionId: string;
        status: string;
        message?: string;
      };
    }
  | {
      type: "notification";
      payload: {
        id: string;
        userId?: string;
        title: string;
        titleAr: string;
        body: string;
        bodyAr: string;
        kind: string;
      };
    }
  | {
      type: "delta";
      payload: { entity: string; id: string; patch: Record<string, unknown> };
    }
  | {
      type: "ai.status";
      payload: {
        requestId: string;
        status: string;
        provider: string;
      };
    };

class WorldRuntime extends EventEmitter {
  engine!: SimulationEngine;
  planetId!: string;
  seed!: string;
  heightPreview: number[][] = [];
  biomePreview: string[] = [];
  resolution = 64;
  running = false;
  private timer: NodeJS.Timeout | null = null;
  tickIntervalMs = Number(process.env.TICK_INTERVAL_MS ?? 5000);
  yearsPerTick = Number(process.env.TICK_YEARS ?? 1);

  async init(seed = process.env.DEFAULT_PLANET_SEED ?? "planet-born-alpha-2026") {
    this.seed = seed;
    const planet = generatePlanet(seed, 64);
    this.resolution = planet.resolution;
    this.heightPreview = heightMapPreview(planet.heightMap, planet.resolution);
    this.biomePreview = planet.biomeMap;
    this.engine = new SimulationEngine(seed, planet.regions, -1000);

    // Find or create planet row
    const existing = await db
      .select()
      .from(schema.planets)
      .where(eq(schema.planets.seed, seed))
      .limit(1);

    if (existing[0]) {
      this.planetId = existing[0].id;
      // Rebuild from seed (deterministic) then fast-forward to stored tick if needed
      this.engine.bootstrapInitialWorld({
        civilizations: 12,
        citiesPerCiv: 3,
        species: 300,
        plants: 800,
        resources: 120,
        technologies: 50,
      });
      // Persist bootstrap if empty events
      const evtCount = await db
        .select()
        .from(schema.worldEvents)
        .where(eq(schema.worldEvents.planetId, this.planetId))
        .limit(1);
      if (!evtCount[0]) {
        await this.persistBootstrap(planet.regions);
      } else {
        // Sync in-memory year/tick from DB
        this.engine.state.tick = existing[0].currentTick;
        this.engine.state.year = existing[0].currentYear;
      }
    } else {
      this.engine.bootstrapInitialWorld({
        civilizations: 12,
        citiesPerCiv: 3,
        species: 300,
        plants: 800,
        resources: 120,
        technologies: 50,
      });
      const [row] = await db
        .insert(schema.planets)
        .values({
          name: "Aetheris",
          nameAr: "أثيريس",
          seed,
          resolution: 64,
          currentTick: 0,
          currentYear: -1000,
          status: "running",
          meta: { tagline: "عالمك، قرارك، أثر لا ينتهي." },
        })
        .returning();
      this.planetId = row!.id;
      await this.persistBootstrap(planet.regions);
    }

    return this;
  }

  private async persistBootstrap(
    regions: ReturnType<typeof generatePlanet>["regions"],
  ) {
    await db.insert(schema.planetRegions).values(
      regions.map((r) => ({
        id: r.id,
        planetId: this.planetId,
        name: r.name,
        nameAr: r.nameAr,
        biome: r.biome,
        lat: r.lat,
        lon: r.lon,
        elevation: r.elevation,
        temperature: r.temperature,
        moisture: r.moisture,
        fertility: r.fertility,
        population: this.engine.state.regions.get(r.id)?.population ?? 0,
        pollution: 0,
        civilizationId: this.engine.state.regions.get(r.id)?.civilizationId ?? null,
        gridX: r.gridX,
        gridY: r.gridY,
      })),
    );

    for (const c of this.engine.state.civilizations.values()) {
      await db.insert(schema.civilizations).values({
        id: c.id,
        planetId: this.planetId,
        name: c.name,
        nameAr: c.nameAr,
        population: c.population,
        techLevel: c.techLevel,
        military: c.military,
        economy: c.economy,
        food: c.food,
        stability: c.stability,
        data: {
          allies: c.allies,
          enemies: c.enemies,
          regionIds: c.regionIds,
          cityIds: c.cityIds,
          government: c.government,
        },
      });
    }

    for (const city of this.engine.state.cities.values()) {
      await db.insert(schema.cities).values({
        id: city.id,
        planetId: this.planetId,
        civilizationId: city.civilizationId,
        regionId: city.regionId,
        name: city.name,
        nameAr: city.nameAr,
        population: city.population,
      });
    }

    // Batch species/plants/resources in chunks
    const sp = [...this.engine.state.species.values()];
    for (let i = 0; i < sp.length; i += 100) {
      await db.insert(schema.species).values(
        sp.slice(i, i + 100).map((s) => ({
          id: s.id,
          planetId: this.planetId,
          name: s.name,
          nameAr: s.nameAr,
          population: s.population,
          traits: s.traits,
          data: { biomes: s.biomes, regionIds: s.regionIds, trophicLevel: s.trophicLevel },
        })),
      );
    }

    const pl = [...this.engine.state.plants.values()];
    for (let i = 0; i < pl.length; i += 100) {
      await db.insert(schema.plants).values(
        pl.slice(i, i + 100).map((p) => ({
          id: p.id,
          planetId: this.planetId,
          name: p.name,
          nameAr: p.nameAr,
          coverage: p.coverage,
          traits: p.traits,
          data: { biomes: p.biomes, regionIds: p.regionIds },
        })),
      );
    }

    const rs = [...this.engine.state.resources.values()];
    for (let i = 0; i < rs.length; i += 100) {
      await db.insert(schema.resources).values(
        rs.slice(i, i + 100).map((r) => ({
          id: r.id,
          planetId: this.planetId,
          name: r.name,
          nameAr: r.nameAr,
          quantity: r.quantity,
          regionId: r.regionId,
          value: r.value,
          data: { renewRate: r.renewRate, controllerCivId: r.controllerCivId },
        })),
      );
    }

    const techs = [...this.engine.state.technologies.values()];
    for (let i = 0; i < techs.length; i += 50) {
      await db.insert(schema.technologies).values(
        techs.slice(i, i + 50).map((t) => ({
          id: t.id,
          planetId: this.planetId,
          name: t.name,
          nameAr: t.nameAr,
          level: t.level,
          data: { civIds: t.civIds },
        })),
      );
    }

    await this.persistEvents([...this.engine.events.all()], [...this.engine.events.edgesAll()]);

    await db.insert(schema.timelineSnapshots).values([
      {
        planetId: this.planetId,
        tick: 0,
        year: -1000,
        label: "Ocean Genesis",
        labelAr: "نشأة المحيطات",
        summary: "Primordial oceans settle across the globe.",
        summaryAr: "استقرت المحيطات الأولى عبر الكوكب.",
        stateBlob: { era: "oceans" },
      },
      {
        planetId: this.planetId,
        tick: 0,
        year: -800,
        label: "Emergence of Life",
        labelAr: "ظهور الحياة",
        summary: "First flora and fauna take root.",
        summaryAr: "ظهرت النباتات والمخلوقات الأولى.",
        stateBlob: { era: "life" },
      },
      {
        planetId: this.planetId,
        tick: 0,
        year: -400,
        label: "Dawn of Civilizations",
        labelAr: "بداية الحضارات",
        summary: "Twelve civilizations rise.",
        summaryAr: "نهضت اثنتا عشرة حضارة.",
        stateBlob: { era: "civs" },
      },
      {
        planetId: this.planetId,
        tick: 0,
        year: 0,
        label: "Present Era",
        labelAr: "العصر الحاضر",
        summary: "The living world awaits your contribution.",
        summaryAr: "العالم الحي ينتظر مساهمتك.",
        stateBlob: { era: "present" },
      },
    ]);
  }

  async persistEvents(
    events: SimEvent[],
    edges: { id: string; causeEventId: string; effectEventId: string; relation: string; strength: number; delayTicks: number }[],
  ) {
    if (events.length) {
      for (let i = 0; i < events.length; i += 50) {
        const chunk = events.slice(i, i + 50);
        await db
          .insert(schema.worldEvents)
          .values(
            chunk.map((e) => ({
              id: e.id,
              planetId: this.planetId,
              type: e.type,
              tick: e.tick,
              year: e.year,
              regionId: e.regionId,
              title: e.title,
              titleAr: e.titleAr,
              description: e.description,
              descriptionAr: e.descriptionAr,
              importance: e.importance,
              cause: e.cause,
              relatedEntityIds: e.relatedEntityIds,
              contributionId: e.contributionId ?? null,
              directImpact: e.directImpact,
              confidence: e.confidence,
              metadata: e.metadata,
            })),
          )
          .onConflictDoNothing();
      }
    }
    if (edges.length) {
      await db
        .insert(schema.causalLinks)
        .values(
          edges.map((e) => ({
            id: e.id,
            planetId: this.planetId,
            causeEventId: e.causeEventId,
            effectEventId: e.effectEventId,
            relation: e.relation,
            strength: e.strength,
            delayTicks: e.delayTicks,
          })),
        )
        .onConflictDoNothing();
    }
  }

  startAutotick() {
    if (this.timer) return;
    this.running = true;
    this.timer = setInterval(() => {
      void this.runTicks(1).catch((err) => console.error("tick error", err));
    }, this.tickIntervalMs);
  }

  stopAutotick() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runTicks(count = 1) {
    const allEvents: SimEvent[] = [];
    for (let i = 0; i < count; i++) {
      const t0 = Date.now();
      const result = this.engine.tick(this.yearsPerTick);
      const durationMs = Date.now() - t0;
      allEvents.push(...result.events);

      await db
        .update(schema.planets)
        .set({
          currentTick: result.tick,
          currentYear: result.year,
        })
        .where(eq(schema.planets.id, this.planetId));

      await db
        .insert(schema.simulationTicks)
        .values({
          planetId: this.planetId,
          tick: result.tick,
          year: result.year,
          eventsCount: result.events.length,
          durationMs,
        })
        .onConflictDoNothing();

      await this.persistEvents(result.events, [...this.engine.events.edgesAll()].filter((e) =>
        result.events.some((ev) => ev.id === e.effectEventId),
      ));

      // Sync civilization populations (sampled)
      for (const c of this.engine.state.civilizations.values()) {
        await db
          .update(schema.civilizations)
          .set({
            population: c.population,
            techLevel: c.techLevel,
            military: c.military,
            economy: c.economy,
            food: c.food,
            stability: c.stability,
          })
          .where(eq(schema.civilizations.id, c.id));
      }

      this.emit("message", {
        type: "simulation.tick",
        payload: {
          tick: result.tick,
          year: result.year,
          eventsCount: result.events.length,
        },
      } satisfies BusMessage);

      for (const ev of result.events) {
        this.emit("message", { type: "world.event", payload: ev } satisfies BusMessage);
      }
      for (const d of result.deltas) {
        this.emit("message", { type: "delta", payload: d } satisfies BusMessage);
      }

      // Contribution follow-up notifications
      for (const ev of result.events) {
        if (ev.contributionId) {
          await this.notifyContributionFollowup(ev);
        }
      }
    }
    return allEvents;
  }

  private async notifyContributionFollowup(ev: SimEvent) {
    if (!ev.contributionId) return;
    const [contrib] = await db
      .select()
      .from(schema.userContributions)
      .where(eq(schema.userContributions.id, ev.contributionId))
      .limit(1);
    if (!contrib) return;

    await db
      .update(schema.userContributions)
      .set({ impactCount: contrib.impactCount + 1 })
      .where(eq(schema.userContributions.id, contrib.id));

    const [notif] = await db
      .insert(schema.notifications)
      .values({
        userId: contrib.userId,
        title: `Your contribution evolved: ${ev.title}`,
        titleAr: `تطور تأثير مساهمتك: ${ev.titleAr}`,
        body: ev.description,
        bodyAr: ev.descriptionAr,
        kind: "contribution_impact",
        meta: { eventId: ev.id, contributionId: contrib.id },
      })
      .returning();

    this.emit("message", {
      type: "notification",
      payload: {
        id: notif!.id,
        userId: contrib.userId,
        title: notif!.title,
        titleAr: notif!.titleAr,
        body: notif!.body,
        bodyAr: notif!.bodyAr,
        kind: notif!.kind,
      },
    } satisfies BusMessage);
  }

  async applyUserElement(
    element: StructuredElement,
    regionId: string,
    contributionId: string,
    userId: string,
  ) {
    this.emit("message", {
      type: "contribution.status",
      payload: { contributionId, status: "simulating" },
    } satisfies BusMessage);

    const beforeTick = this.engine.state.tick;
    this.engine.takeSnapshot(); // snapshot before for compare
    const { events, entityId } = this.engine.applyContribution(
      element,
      regionId,
      contributionId,
    );
    await this.persistEvents(events, [...this.engine.events.edgesAll()].filter((e) =>
      events.some((ev) => ev.id === e.effectEventId || ev.id === e.causeEventId),
    ));

    // Persist new entity lightly
    if (element.category === "plant") {
      const p = this.engine.state.plants.get(entityId);
      if (p) {
        await db.insert(schema.plants).values({
          id: p.id,
          planetId: this.planetId,
          name: p.name,
          nameAr: p.nameAr,
          coverage: p.coverage,
          traits: p.traits,
          contributionId,
          data: { biomes: p.biomes, regionIds: p.regionIds },
        }).onConflictDoNothing();
      }
    } else if (element.category === "creature") {
      const s = this.engine.state.species.get(entityId);
      if (s) {
        await db.insert(schema.species).values({
          id: s.id,
          planetId: this.planetId,
          name: s.name,
          nameAr: s.nameAr,
          population: s.population,
          traits: s.traits,
          contributionId,
          data: { biomes: s.biomes, regionIds: s.regionIds },
        }).onConflictDoNothing();
      }
    }

    await db
      .update(schema.userContributions)
      .set({
        status: "committed",
        regionId,
        entityId,
        tickCommitted: this.engine.state.tick,
        yearCommitted: this.engine.state.year,
        impactCount: events.length,
      })
      .where(eq(schema.userContributions.id, contributionId));

    await db.insert(schema.timelineSnapshots).values({
      planetId: this.planetId,
      tick: this.engine.state.tick,
      year: this.engine.state.year,
      label: `Contribution: ${element.name}`,
      labelAr: `مساهمة: ${element.nameAr ?? element.name}`,
      summary: `User added ${element.category}`,
      summaryAr: `أضاف المستخدم ${element.category}`,
      stateBlob: {
        contributionId,
        beforeTick,
        category: element.category,
        entityId,
      },
    });

    const [notif] = await db
      .insert(schema.notifications)
      .values({
        userId,
        title: `Your element entered the world`,
        titleAr: `دخل عنصرك إلى العالم`,
        body: `${element.name} is now part of planetary history.`,
        bodyAr: `${element.nameAr ?? element.name} أصبح جزءًا من تاريخ الكوكب.`,
        kind: "contribution_committed",
        meta: { contributionId, entityId },
      })
      .returning();

    for (const ev of events) {
      this.emit("message", { type: "world.event", payload: ev } satisfies BusMessage);
    }
    this.emit("message", {
      type: "contribution.status",
      payload: { contributionId, status: "committed" },
    } satisfies BusMessage);
    this.emit("message", {
      type: "notification",
      payload: {
        id: notif!.id,
        userId,
        title: notif!.title,
        titleAr: notif!.titleAr,
        body: notif!.body,
        bodyAr: notif!.bodyAr,
        kind: notif!.kind,
      },
    } satisfies BusMessage);

    // Run a few ticks so impact evolves immediately
    await this.runTicks(3);

    return { events, entityId, beforeTick };
  }

  broadcast(msg: BusMessage) {
    this.emit("message", msg);
  }
}

export const worldRuntime = new WorldRuntime();

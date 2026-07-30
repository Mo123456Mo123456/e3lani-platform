import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { analyzeContribution } from './ai-client.js';
import { moderateContribution } from './moderation.js';
import { runSimulationTick } from './simulation-client.js';
import { publish } from '../ws-bridge.js';

export type ContributionInput = {
  userId: string;
  planetId: string;
  type: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
};

export async function createAndProcessContribution(input: ContributionInput, opts?: { inject?: boolean }) {
  const db = getDb();
  const id = nanoid();

  await db.insert(s.userContributions).values({
    id,
    userId: input.userId,
    planetId: input.planetId,
    type: input.type,
    title: input.title,
    description: input.description,
    payload: input.payload || {},
    status: 'pending',
  });

  // Step 1: moderation
  const mod = await moderateContribution(id, `${input.title}\n${input.description || ''}`);
  if (mod.status === 'rejected') {
    await db.update(s.userContributions).set({ status: 'rejected', updatedAt: new Date().toISOString() }).where(eq(s.userContributions.id, id));
    return { id, status: 'rejected' as const, moderation: mod };
  }

  // Step 2: analyze
  await db.update(s.userContributions).set({ status: 'analyzing', updatedAt: new Date().toISOString() }).where(eq(s.userContributions.id, id));
  const analysis = await analyzeContribution({
    userId: input.userId,
    contributionId: id,
    type: input.type,
    title: input.title,
    description: input.description,
    payload: input.payload,
  });

  // Step 3: balance
  const balanceScore = Number((1 - analysis.risk * 0.7).toFixed(4));
  await db
    .update(s.userContributions)
    .set({
      status: 'balanced',
      analysis: analysis as unknown as Record<string, unknown>,
      balanceScore,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(s.userContributions.id, id));

  // Step 4: preview
  const planets = await db.select().from(s.planets).where(eq(s.planets.id, input.planetId)).limit(1);
  const planet = planets[0];
  if (!planet) {
    throw Object.assign(new Error('Planet not found'), { statusCode: 404 });
  }

  const previewTick = planet.currentTick + 1;
  const preview = await runSimulationTick({
    planetId: planet.id,
    seed: planet.seed,
    tick: previewTick,
    contribution: { type: input.type, title: input.title, payload: input.payload || {} },
  });

  await db.update(s.userContributions).set({ status: 'preview', updatedAt: new Date().toISOString() }).where(eq(s.userContributions.id, id));

  if (!opts?.inject) {
    return {
      id,
      status: 'preview' as const,
      moderation: mod,
      analysis,
      balanceScore,
      preview,
    };
  }

  // Step 5: inject into sim + store events
  return injectContribution(id);
}

export async function injectContribution(contributionId: string) {
  const db = getDb();
  const rows = await db.select().from(s.userContributions).where(eq(s.userContributions.id, contributionId)).limit(1);
  const contrib = rows[0];
  if (!contrib) throw Object.assign(new Error('Contribution not found'), { statusCode: 404 });
  if (contrib.status === 'injected') {
    return { id: contrib.id, status: 'injected' as const, already: true };
  }
  if (contrib.status === 'rejected') {
    throw Object.assign(new Error('Cannot inject rejected contribution'), { statusCode: 400 });
  }

  const planets = await db.select().from(s.planets).where(eq(s.planets.id, contrib.planetId)).limit(1);
  const planet = planets[0]!;
  const tick = planet.currentTick + 1;

  const delta = await runSimulationTick({
    planetId: planet.id,
    seed: planet.seed,
    tick,
    contribution: {
      type: contrib.type,
      title: contrib.title,
      payload: (contrib.payload as Record<string, unknown>) || {},
    },
  });

  const eventIds: string[] = [];
  let prevEventId: string | null = null;
  for (const ev of delta.events) {
    const eid = nanoid();
    eventIds.push(eid);
    await db.insert(s.worldEvents).values({
      id: eid,
      planetId: planet.id,
      tick,
      type: ev.type,
      title: ev.title,
      description: ev.description,
      severity: ev.severity,
      actors: ev.actors,
      payload: ev.payload,
      contributionId: contrib.id,
    });
    if (prevEventId) {
      await db.insert(s.causalLinks).values({
        id: nanoid(),
        planetId: planet.id,
        causeEventId: prevEventId,
        effectEventId: eid,
        relation: 'caused',
        strength: 0.8,
        explanation: `${ev.type} follows prior contribution effect`,
      });
    }
    prevEventId = eid;
  }

  await db.insert(s.simulationTicks).values({
    id: nanoid(),
    planetId: planet.id,
    tick,
    year: delta.year,
    deltaSummary: { source: delta.source, events: delta.events.length, patches: delta.patches },
  });

  // Persist entity stub for determinism tracking
  let injectedEntityId: string | undefined;
  if (contrib.type === 'species') {
    injectedEntityId = nanoid();
    await db.insert(s.species).values({
      id: injectedEntityId,
      planetId: planet.id,
      name: contrib.title,
      scientificName: `Injected ${contrib.title}`,
      population: 500,
      traits: contrib.payload as Record<string, unknown>,
    });
  } else if (contrib.type === 'plant') {
    injectedEntityId = nanoid();
    await db.insert(s.plants).values({
      id: injectedEntityId,
      planetId: planet.id,
      name: contrib.title,
      traits: contrib.payload as Record<string, unknown>,
    });
  } else if (contrib.type === 'invention') {
    injectedEntityId = nanoid();
    await db.insert(s.technologies).values({
      id: injectedEntityId,
      planetId: planet.id,
      name: contrib.title,
      category: 'user',
      discoveredAtTick: tick,
      effects: contrib.payload as Record<string, unknown>,
    });
  }

  await db
    .update(s.planets)
    .set({ currentTick: tick, ageYears: delta.year, updatedAt: new Date().toISOString() })
    .where(eq(s.planets.id, planet.id));

  await db
    .update(s.userContributions)
    .set({
      status: 'injected',
      injectedAtTick: tick,
      injectedEntityId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(s.userContributions.id, contrib.id));

  // Notify owner
  await db.insert(s.notifications).values({
    id: nanoid(),
    userId: contrib.userId,
    type: 'contribution_injected',
    title: 'تم حقن مساهمتك في المحاكاة',
    body: contrib.title,
    payload: { contributionId: contrib.id, tick, eventIds },
  });

  publish({
    type: 'planet.delta',
    planetId: planet.id,
    tick,
    events: delta.events,
    patches: delta.patches,
  });

  publish({
    type: 'user.notification',
    userId: contrib.userId,
    payload: { contributionId: contrib.id, status: 'injected' },
  });

  return {
    id: contrib.id,
    status: 'injected' as const,
    tick,
    year: delta.year,
    events: delta.events,
    patches: delta.patches,
    eventIds,
    source: delta.source,
    injectedEntityId,
  };
}

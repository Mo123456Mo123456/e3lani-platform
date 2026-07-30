import { runLocalTick, type SimDelta } from './local-sim.js';

export type SimInjectInput = {
  planetId: string;
  seed: string;
  tick: number;
  contribution?: { type: string; title: string; payload: Record<string, unknown> };
};

async function tryRemoteSim(input: SimInjectInput): Promise<SimDelta | null> {
  const base = process.env.SIM_ENGINE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/tick`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SimDelta;
  } catch {
    return null;
  }
}

async function trySimulationModels(input: SimInjectInput): Promise<SimDelta | null> {
  try {
    // Dynamic import — package API may evolve; fall back to local-sim on mismatch.
    const mod = (await import('@planet/simulation-models')) as Record<string, unknown>;
    const Engine = mod.SimulationTickEngine as
      | (new (seed: string) => {
          runTicks: (n: number) => Array<{
            type: string;
            tick: number;
            payload: Record<string, unknown>;
            narrativeHints?: string[];
            directEffects?: string[];
          }>;
          injectUserElement?: (el: {
            contributionId: string;
            category: string;
            title: string;
            traits: Record<string, unknown>;
          }) => Array<{
            type: string;
            tick: number;
            payload: Record<string, unknown>;
            narrativeHints?: string[];
          }>;
          getTick: () => number;
        })
      | undefined;

    if (!Engine) return null;

    const engine = new Engine(input.seed);
    let records = engine.runTicks(1);
    if (input.contribution && typeof engine.injectUserElement === 'function') {
      const category =
        input.contribution.type === 'species'
          ? 'species'
          : input.contribution.type === 'plant'
            ? 'flora'
            : input.contribution.type === 'invention'
              ? 'technology'
              : 'element';
      records = engine.injectUserElement({
        contributionId: 'api',
        category,
        title: input.contribution.title,
        traits: input.contribution.payload,
      });
    }

    return {
      tick: input.tick,
      year: input.tick * 90,
      events: records.map((ev) => ({
        type: String(ev.type),
        title: ev.narrativeHints?.[0] || String(ev.type),
        description: ev.narrativeHints?.join(' '),
        severity: 'info',
        actors: [],
        payload: ev.payload || {},
      })),
      patches: [{ path: 'currentTick', value: input.tick }],
    };
  } catch {
    return null;
  }
}

export async function runSimulationTick(input: SimInjectInput): Promise<SimDelta & { source: string }> {
  const remote = await tryRemoteSim(input);
  if (remote) return { ...remote, source: 'sim-engine' };

  const models = await trySimulationModels(input);
  if (models) return { ...models, source: 'simulation-models' };

  const local = runLocalTick(input);
  return { ...local, source: 'local-sim' };
}

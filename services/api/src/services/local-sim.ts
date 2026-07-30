/**
 * Deterministic local simulation fallback when SIM_ENGINE_URL / @planet/simulation-models
 * are unavailable.
 */
export type SimDelta = {
  tick: number;
  year: number;
  events: Array<{
    type: string;
    title: string;
    description?: string;
    severity: string;
    actors: string[];
    payload: Record<string, unknown>;
  }>;
  patches: Array<{ path: string; value: unknown }>;
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runLocalTick(input: {
  planetId: string;
  seed: string;
  tick: number;
  contribution?: { type: string; title: string; payload: Record<string, unknown> };
}): SimDelta {
  const rng = mulberry32(hash(`${input.seed}:${input.tick}:${input.contribution?.title || ''}`));
  const events: SimDelta['events'] = [];
  const patches: SimDelta['patches'] = [];

  if (input.contribution) {
    const t = input.contribution.type;
    events.push({
      type: `contribution_${t}`,
      title: `حقن: ${input.contribution.title}`,
      description: `مساهمة من نوع ${t} أُدخلت في التيك ${input.tick}`,
      severity: 'major',
      actors: [],
      payload: { ...input.contribution.payload, contributionType: t },
    });

    if (t === 'species') {
      events.push({
        type: 'species_depends_on_plant',
        title: 'اعتماد نوع على نبات',
        description: 'النوع الجديد يعتمد على غطاء نباتي محلي',
        severity: 'info',
        actors: [],
        payload: { relation: 'depends_on_plant' },
      });
    }
    if (t === 'invention') {
      events.push({
        type: 'civ_uses_invention',
        title: 'حضارة تتبنى الاختراع',
        description: 'قفزة تقنية محلية',
        severity: 'minor',
        actors: [],
        payload: { techBoost: 0.05 + rng() * 0.1 },
      });
      patches.push({ path: 'techLevel', value: Number((0.05 + rng() * 0.1).toFixed(4)) });
    }
    if (t === 'element') {
      events.push({
        type: 'war_caused_by_element',
        title: 'توتر بسبب عنصر نادر',
        description: 'صراع ناشئ عن مورد جديد',
        severity: 'major',
        actors: [],
        payload: { conflictChance: Number(rng().toFixed(4)) },
      });
    }
    if (t === 'plant') {
      events.push({
        type: 'spread',
        title: 'انتشار نباتي',
        description: 'النبات الجديد ينتشر في المناطق المجاورة',
        severity: 'info',
        actors: [],
        payload: { coverageDelta: Number((rng() * 0.2).toFixed(4)) },
      });
    }

    // long-term echo
    events.push({
      type: 'long_term_effect',
      title: 'أثر طويل الأمد',
      description: `أثر مؤجل لمساهمة ${input.contribution.title}`,
      severity: 'info',
      actors: [],
      payload: { horizonTicks: 10 + Math.floor(rng() * 20) },
    });
  } else {
    const roll = rng();
    if (roll > 0.7) {
      events.push({
        type: 'climate_shift',
        title: 'تغير مناخي طفيف',
        severity: 'info',
        actors: [],
        payload: { deltaTemp: Number(((rng() - 0.5) * 2).toFixed(3)) },
      });
    } else if (roll > 0.4) {
      events.push({
        type: 'population_growth',
        title: 'نمو سكاني',
        severity: 'info',
        actors: [],
        payload: { growth: Number((rng() * 0.05).toFixed(4)) },
      });
    } else {
      events.push({
        type: 'quiet_tick',
        title: 'تيك هادئ',
        severity: 'info',
        actors: [],
        payload: {},
      });
    }
  }

  patches.push({ path: 'currentTick', value: input.tick });
  return {
    tick: input.tick,
    year: input.tick * 90,
    events,
    patches,
  };
}

export function generateLocalPlanet(seed: string, resolution = 32) {
  const rng = mulberry32(hash(seed));
  const cells = [];
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      cells.push({
        x,
        y,
        elevation: Number((rng() * 4000 - 500).toFixed(2)),
        moisture: Number(rng().toFixed(3)),
        temperature: Number((-20 + rng() * 55).toFixed(2)),
      });
    }
  }
  return { seed, resolution, cells, generatedAt: new Date().toISOString() };
}

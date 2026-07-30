import type {
  ContributionAnalysis,
  ContributionRequest,
  ContributionResult,
  EventKind,
  Region,
  SimulationForecast,
  WorldEvent,
  WorldSnapshot,
} from "./types";
import { hashString, seededRandom } from "./world";

const REGION_SEEDS: Array<
  Omit<Region, "population" | "vitality" | "stability">
> = [
  {
    id: "arabian-nexus",
    name: { ar: "الحاضرة العربية", en: "Arabian Nexus" },
    latitude: 25,
    longitude: 45,
    terrainColor: "#19b890",
    accentColor: "#75fbd3",
    cityLights: 32,
  },
  {
    id: "sahara-solar",
    name: { ar: "حزام الصحراء الشمسي", en: "Sahara Solar Belt" },
    latitude: 24,
    longitude: 9,
    terrainColor: "#ba7f42",
    accentColor: "#ffc76b",
    cityLights: 14,
  },
  {
    id: "european-gardens",
    name: { ar: "حدائق أوروبا", en: "European Gardens" },
    latitude: 50,
    longitude: 13,
    terrainColor: "#48a762",
    accentColor: "#9dffad",
    cityLights: 42,
  },
  {
    id: "asian-canopy",
    name: { ar: "مظلة آسيا", en: "Asian Canopy" },
    latitude: 34,
    longitude: 104,
    terrainColor: "#238c6c",
    accentColor: "#68f8c0",
    cityLights: 48,
  },
  {
    id: "pacific-arc",
    name: { ar: "قوس المحيط الهادئ", en: "Pacific Arc" },
    latitude: 4,
    longitude: 147,
    terrainColor: "#176f8a",
    accentColor: "#55dff9",
    cityLights: 11,
  },
  {
    id: "amazon-reserve",
    name: { ar: "محمية الأمازون", en: "Amazon Reserve" },
    latitude: -7,
    longitude: -61,
    terrainColor: "#176f50",
    accentColor: "#5cf7a2",
    cityLights: 19,
  },
  {
    id: "andes-waterline",
    name: { ar: "خط مياه الأنديز", en: "Andes Waterline" },
    latitude: -22,
    longitude: -69,
    terrainColor: "#647658",
    accentColor: "#a5efcb",
    cityLights: 16,
  },
  {
    id: "north-american-grid",
    name: { ar: "الشبكة الأمريكية الشمالية", en: "North American Grid" },
    latitude: 42,
    longitude: -102,
    terrainColor: "#2f8874",
    accentColor: "#78ffe2",
    cityLights: 44,
  },
  {
    id: "african-great-lakes",
    name: { ar: "البحيرات الأفريقية الكبرى", en: "African Great Lakes" },
    latitude: -3,
    longitude: 31,
    terrainColor: "#3c9862",
    accentColor: "#9cf4a0",
    cityLights: 24,
  },
  {
    id: "austral-commons",
    name: { ar: "المشاع الجنوبي", en: "Austral Commons" },
    latitude: -29,
    longitude: 135,
    terrainColor: "#a26845",
    accentColor: "#ffb981",
    cityLights: 21,
  },
  {
    id: "polar-vault",
    name: { ar: "الخزنة القطبية", en: "Polar Vault" },
    latitude: 76,
    longitude: -35,
    terrainColor: "#8fc3c3",
    accentColor: "#d5ffff",
    cityLights: 5,
  },
  {
    id: "indian-blue",
    name: { ar: "الممر الهندي الأزرق", en: "Indian Blue Corridor" },
    latitude: 9,
    longitude: 77,
    terrainColor: "#187d88",
    accentColor: "#71edff",
    cityLights: 34,
  },
];

let cycle = 1842;
let impacts: Record<string, number> = {};
let submittedEvents: WorldEvent[] = [];

function delay(ms = 260): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function getRegions(): Region[] {
  return REGION_SEEDS.map((region) => {
    const random = seededRandom(hashString(`${region.id}:${cycle}`));
    const impact = impacts[region.id] ?? 0;
    return {
      ...region,
      population: Math.round(37_000_000 + random() * 780_000_000),
      vitality: Math.min(99, Math.round(62 + random() * 28 + impact)),
      stability: Math.min(99, Math.round(58 + random() * 33 + impact * 0.6)),
    };
  });
}

export async function getSandboxWorld(): Promise<WorldSnapshot> {
  await delay();
  const regions = getRegions();
  return {
    id: "sandbox-gaia-7",
    name: "كوكب غايا التجريبي",
    generatedAt: new Date().toISOString(),
    cycle,
    temperature: 14.7,
    population: regions.reduce((sum, region) => sum + region.population, 0),
    vitality: Math.round(
      regions.reduce((sum, region) => sum + region.vitality, 0) /
        regions.length,
    ),
    stability: 78,
    biodiversity: 84,
    isPaused: false,
    regions,
    timeline: Array.from({ length: 12 }, (_, index) => {
      const random = seededRandom(800 + index);
      return {
        year: 2044 + index,
        vitality: Math.round(64 + index * 1.45 + random() * 5),
        temperature: Number((15.2 - index * 0.045 + random() * 0.1).toFixed(2)),
        population: 7_800_000_000 + index * 91_000_000,
        ...(index === 7
          ? { label: { ar: "ميثاق الماء", en: "Water Accord" } }
          : {}),
      };
    }),
  };
}

export async function getSandboxEvents(): Promise<WorldEvent[]> {
  await delay(170);
  const now = Date.now();
  const defaults: WorldEvent[] = [
    {
      id: "evt-solar-1",
      kind: "energy",
      title: { ar: "قفزة في إنتاج الطاقة", en: "Energy output surge" },
      description: {
        ar: "دخلت شبكة شمسية ذاتية التوازن الخدمة.",
        en: "A self-balancing solar grid entered service.",
      },
      regionId: "sahara-solar",
      latitude: 24,
      longitude: 9,
      impact: 8,
      occurredAt: new Date(now - 7 * 60_000).toISOString(),
    },
    {
      id: "evt-water-2",
      kind: "water",
      title: { ar: "تعافي حوض مائي", en: "Watershed recovery" },
      description: {
        ar: "ارتفع مخزون المياه الجوفية بعد موسم التجدد.",
        en: "Aquifer reserves rose after a regeneration cycle.",
      },
      regionId: "andes-waterline",
      latitude: -22,
      longitude: -69,
      impact: 5,
      occurredAt: new Date(now - 24 * 60_000).toISOString(),
    },
    {
      id: "evt-forest-3",
      kind: "climate",
      title: { ar: "المظلة الخضراء تتسع", en: "Green canopy expands" },
      description: {
        ar: "تم رصد نمو جديد على امتداد المحمية.",
        en: "New growth was detected across the reserve.",
      },
      regionId: "amazon-reserve",
      latitude: -7,
      longitude: -61,
      impact: 6,
      occurredAt: new Date(now - 51 * 60_000).toISOString(),
    },
    {
      id: "evt-community-4",
      kind: "community",
      title: { ar: "مجتمع جديد متصل", en: "New community connected" },
      description: {
        ar: "اكتملت حلقة نقل عامة خالية من الانبعاثات.",
        en: "A zero-emission public transit loop is complete.",
      },
      regionId: "asian-canopy",
      latitude: 34,
      longitude: 104,
      impact: 4,
      occurredAt: new Date(now - 2.2 * 60 * 60_000).toISOString(),
    },
  ];

  return [...submittedEvents, ...defaults];
}

export async function analyzeSandboxContribution(
  request: ContributionRequest,
): Promise<ContributionAnalysis> {
  await delay(420);
  const random = seededRandom(hashString(request.proposal));
  const temperatureIdea = /climate|temperature|مناخ|حرار/i.test(
    request.proposal,
  );
  const title = request.proposal.split("\n")[0]?.slice(0, 80) || "مساهمة جديدة";
  return {
    title,
    summary:
      "تحليل حتمي محلي للمقترح ضمن وضع المتصفح التجريبي؛ لا يمثل استجابة من خدمة الإنتاج.",
    category: temperatureIdea ? "climate" : "ecology",
    plausibility: Number((0.7 + random() * 0.2).toFixed(2)),
    confidence: 0.78,
    effects: [
      {
        metric: temperatureIdea ? "temperature" : "biodiversity",
        delta: Number((0.03 + random() * 0.07).toFixed(3)),
        regionId: request.regionId,
        civilizationId: null,
        rationale: "أثر محلي محدود مشتق حتميًا من بيانات البيئة التجريبية.",
      },
      {
        metric: "stability",
        delta: -0.02,
        regionId: request.regionId,
        civilizationId: null,
        rationale: "تكلفة انتقال قصيرة الأمد أثناء بدء التطبيق.",
      },
    ],
    warnings: [
      "تحليل محلي معلن؛ لم يتم الاتصال بمزود ذكاء اصطناعي أو خدمة إنتاج.",
    ],
    provider: "deterministic-browser-sandbox",
  };
}

export async function previewSandboxContribution(
  request: ContributionRequest,
): Promise<SimulationForecast> {
  await delay(520);
  const analysis = await analyzeSandboxContribution(request);
  return {
    confidence: analysis.confidence,
    acceptanceProbability: analysis.plausibility,
    riskOfInstability: 0.08,
    samples: 250,
    summary: { ar: analysis.summary, en: analysis.summary },
    metrics: analysis.effects.map((effect) => ({
      key: effect.metric,
      low: effect.delta * 0.7,
      median: effect.delta,
      high: effect.delta * 1.3,
      unit: "Δ",
    })),
    risks: [
      ...analysis.warnings,
      ...analysis.effects
        .filter((effect) => effect.delta < 0)
        .map((effect) => effect.rationale),
    ],
    benefits: analysis.effects
      .filter((effect) => effect.delta >= 0)
      .map((effect) => effect.rationale),
    analysis,
  };
}

export async function commitSandboxContribution(
  request: ContributionRequest,
): Promise<ContributionResult> {
  await delay(640);
  const analysis = await analyzeSandboxContribution(request);
  cycle += 1;
  const regionId = request.regionId ?? REGION_SEEDS[0]?.id ?? "";
  impacts[regionId] = Math.min(12, (impacts[regionId] ?? 0) + 4);
  const region = REGION_SEEDS.find((item) => item.id === regionId);
  const kind: EventKind =
    analysis.category === "climate" ? "climate" : "community";
  submittedEvents = [
    {
      id: `evt-contribution-${cycle}`,
      kind,
      title: { ar: analysis.title, en: analysis.title },
      description: {
        ar: "تم اعتماد مساهمة مجتمعية وبدأت محاكاتها على الكوكب.",
        en: "A community contribution was accepted and is now being simulated.",
      },
      regionId,
      latitude: region?.latitude ?? 0,
      longitude: region?.longitude ?? 0,
      impact: 7,
      occurredAt: new Date().toISOString(),
    },
    ...submittedEvents,
  ].slice(0, 4);

  return {
    id: `sandbox-contribution-${cycle}`,
    acceptedAt: new Date().toISOString(),
    affectedRegionId: regionId,
    message: {
      ar: "وصلت فكرتك إلى الكوكب وبدأ أثرها بالظهور.",
      en: "Your idea reached the planet and its impact is now emerging.",
    },
  };
}

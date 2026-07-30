import type { TickUnit } from "@planet/shared-types";
import { BIOME_LABELS, classifyBiome } from "./biomes.js";
import { FractalNoise } from "./noise.js";
import { SeededRandom, hashSeed } from "./rng.js";
import type {
  SimCity,
  SimCivilization,
  SimPlant,
  SimRegion,
  SimResource,
  SimSpecies,
  SimTechnology,
  WorldState,
} from "./world-state.js";

const REGION_GRID = 18; // 18x18 = 324 cells, land subset used
const CIV_COUNT = 12;
const CITY_COUNT = 40;
const RESOURCE_COUNT = 120;
const SPECIES_COUNT = 300;
const PLANT_COUNT = 800;
const TECH_COUNT = 50;

const CIV_NAMES = [
  ["Aurion", "أوريون"],
  ["Veldara", "فيلدارا"],
  ["Kethos", "كيثوس"],
  ["Nalira", "ناليرا"],
  ["Sorvane", "سورفان"],
  ["Drayel", "درايل"],
  ["Quorin", "كورين"],
  ["Miraleth", "ميراليث"],
  ["Tashkar", "تشكار"],
  ["Elyndor", "إليندور"],
  ["Zafira", "زفيرا"],
  ["Orrukhan", "أوروخان"],
];

const TECH_NAMES = [
  ["Fire Control", "السيطرة على النار"],
  ["Stone Tools", "أدوات حجرية"],
  ["Agriculture", "الزراعة"],
  ["Pottery", "الفخار"],
  ["Bronze Working", "صناعة البرونز"],
  ["Writing", "الكتابة"],
  ["Wheel", "العجلة"],
  ["Irrigation", "الري"],
  ["Sailing", "الملاحة"],
  ["Iron Working", "صناعة الحديد"],
  ["Mathematics", "الرياضيات"],
  ["Medicine", "الطب"],
  ["Architecture", "العمارة"],
  ["Metallurgy", "علم المعادن"],
  ["Astronomy", "علم الفلك"],
  ["Currency", "العملة"],
  ["Law Codes", "القوانين"],
  ["Siegecraft", "هندسة الحصار"],
  ["Alchemy", "الكيمياء القديمة"],
  ["Compass", "البوصلة"],
  ["Paper", "الورق"],
  ["Printing", "الطباعة"],
  ["Gunpowder", "البارود"],
  ["Optics", "البصريات"],
  ["Steam Power", "الطاقة البخارية"],
  ["Electricity", "الكهرباء"],
  ["Vaccines", "اللقاحات"],
  ["Steel", "الفولاذ"],
  ["Railways", "السكك الحديدية"],
  ["Telegraph", "التلغراف"],
  ["Combustion Engine", "محرك الاحتراق"],
  ["Radio", "الراديو"],
  ["Aviation", "الطيران"],
  ["Antibiotics", "المضادات الحيوية"],
  ["Computers", "الحواسيب"],
  ["Satellites", "الأقمار الصناعية"],
  ["Renewable Energy", "الطاقة المتجددة"],
  ["Genetic Engineering", "الهندسة الوراثية"],
  ["Fusion Research", "أبحاث الاندماج"],
  ["Climate Engineering", "هندسة المناخ"],
  ["Quantum Sensing", "الاستشعار الكمي"],
  ["Ocean Farming", "الزراعة المحيطية"],
  ["Atmospheric Scrubbers", "منقّيات الغلاف الجوي"],
  ["Neural Networks", "الشبكات العصبية"],
  ["Space Elevator Concept", "مفهوم مصعد الفضاء"],
  ["Deep Mining", "التعدين العميق"],
  ["Desalination", "تحلية المياه"],
  ["Synthetic Biology", "البيولوجيا التركيبية"],
  ["Carbon Capture", "احتجاز الكربون"],
  ["Planetary Defense", "الدفاع الكوكبي"],
];

export interface GenerateOptions {
  planetId: string;
  seed: number | string;
  name?: string;
  nameAr?: string;
  tickUnit?: TickUnit;
  /** When true, generate full demo counts; false for fast tests */
  full?: boolean;
}

export function generateWorld(opts: GenerateOptions): WorldState {
  const seed = hashSeed(opts.seed);
  const rng = new SeededRandom(seed);
  const heightNoise = new FractalNoise(seed);
  const moistNoise = new FractalNoise(seed ^ 0xabc123);
  const tempNoise = new FractalNoise(seed ^ 0x55aa55);
  const full = opts.full !== false;

  const regions = generateRegions(rng, heightNoise, moistNoise, tempNoise);
  const land = regions.filter((r) => r.biome !== "ocean");
  linkNeighbors(regions);

  const civilizations = spawnCivilizations(rng, land, full ? CIV_COUNT : 3);
  const cities = spawnCities(rng, civilizations, land, full ? CITY_COUNT : 6);
  assignCities(civilizations, cities);

  const resources = spawnResources(rng, land, full ? RESOURCE_COUNT : 12);
  const species = spawnSpecies(rng, land, full ? SPECIES_COUNT : 20);
  const plants = spawnPlants(rng, land, full ? PLANT_COUNT : 30);
  const technologies = spawnTechnologies(rng, civilizations, full ? TECH_COUNT : 8);

  // Bootstrap history ticks as events later via bootstrapHistory
  const state: WorldState = {
    planetId: opts.planetId,
    seed,
    name: opts.name ?? "Aetheris",
    nameAr: opts.nameAr ?? "أثيريس",
    tick: 0,
    tickUnit: opts.tickUnit ?? "year",
    year: 0,
    regions,
    species,
    plants,
    resources,
    civilizations,
    cities,
    technologies,
    wars: [],
    migrations: [],
    tradeRoutes: [],
    diseases: [],
    contributions: [],
    events: [],
    causalLinks: [],
    rngState: rng.getState(),
  };

  bootstrapTimeline(state, rng);
  return state;
}

function generateRegions(
  rng: SeededRandom,
  heightNoise: FractalNoise,
  moistNoise: FractalNoise,
  tempNoise: FractalNoise,
): SimRegion[] {
  const regions: SimRegion[] = [];
  let idx = 0;
  for (let y = 0; y < REGION_GRID; y++) {
    for (let x = 0; x < REGION_GRID; x++) {
      const u = x / (REGION_GRID - 1);
      const v = y / (REGION_GRID - 1);
      const lon = u * 360 - 180;
      const lat = v * 180 - 90;
      const latNorm = lat / 90;

      let elevation = heightNoise.fbm(u * 3.5, v * 3.5, 6) * 0.5 + 0.5;
      // Continental shaping
      elevation = elevation * 0.7 + (1 - Math.abs(latNorm) * 0.15) * 0.15;
      elevation += (heightNoise.worley(u * 4, v * 4) - 0.5) * 0.08;
      elevation = clamp(elevation, 0, 1);

      const baseTemp = 1 - Math.abs(latNorm) * 0.85;
      const tempMod = tempNoise.fbm(u * 2, v * 2, 3) * 0.15;
      const temperature = clamp(baseTemp - elevation * 0.35 + tempMod, 0, 1);

      let moisture = moistNoise.fbm(u * 4 + 10, v * 4 + 10, 4) * 0.5 + 0.5;
      // Coastal moisture boost, rain shadow approx
      if (elevation < 0.35) moisture += 0.15;
      if (elevation > 0.65) moisture -= 0.2;
      moisture = clamp(moisture, 0, 1);

      const biome = classifyBiome({
        elevation,
        temperature,
        moisture,
        latitude: latNorm,
      });

      const fertility =
        biome === "ocean"
          ? 0
          : clamp(
              moisture * 0.5 +
                (1 - Math.abs(temperature - 0.55)) * 0.3 +
                (biome.includes("forest") ? 0.2 : 0) -
                (biome === "desert" ? 0.3 : 0),
              0,
              1,
            );

      const labels = BIOME_LABELS[biome];
      regions.push({
        id: `reg_${idx}`,
        index: idx,
        name: `${labels.en} ${idx}`,
        nameAr: `${labels.ar} ${idx}`,
        lat,
        lon,
        elevation,
        temperature,
        moisture,
        fertility,
        pollution: rng.float(0, 0.08),
        biome,
        population: 0,
        water: biome === "ocean" ? 1 : clamp(moisture * 0.8 + (elevation < 0.4 ? 0.2 : 0), 0, 1),
        neighbors: [],
      });
      idx++;
    }
  }
  return regions;
}

function linkNeighbors(regions: SimRegion[]): void {
  for (const r of regions) {
    const x = r.index % REGION_GRID;
    const y = Math.floor(r.index / REGION_GRID);
    const n: number[] = [];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < REGION_GRID && ny >= 0 && ny < REGION_GRID) {
        n.push(ny * REGION_GRID + nx);
      }
    }
    r.neighbors = n;
  }
}

function spawnCivilizations(
  rng: SeededRandom,
  land: SimRegion[],
  count: number,
): SimCivilization[] {
  const picks = rng.shuffle(land).slice(0, count);
  return picks.map((region, i) => {
    const [en, ar] = CIV_NAMES[i % CIV_NAMES.length]!;
    const pop = rng.int(80_000, 2_500_000);
    region.population += pop;
    return {
      id: `civ_${i}`,
      name: en,
      nameAr: ar,
      regionIds: [region.id],
      capitalCityId: "",
      population: pop,
      techLevel: rng.float(0.1, 0.7),
      military: rng.float(0.1, 0.8),
      economy: rng.float(0.2, 0.85),
      food: rng.float(0.3, 0.95),
      health: rng.float(0.4, 0.95),
      stability: rng.float(0.35, 0.9),
      happiness: rng.float(0.3, 0.9),
      education: rng.float(0.1, 0.8),
      pollution: rng.float(0.05, 0.4),
      aggression: rng.float(0.1, 0.7),
      innovation: rng.float(0.1, 0.8),
      culture: rng.pick(["nomadic", "agrarian", "maritime", "scholarly", "warrior"]),
      language: `lang_${i}`,
      government: rng.pick(["tribal", "monarchy", "republic", "theocracy", "council"]),
      allies: [],
      enemies: [],
      memory: [],
    };
  });
}

function spawnCities(
  rng: SeededRandom,
  civs: SimCivilization[],
  land: SimRegion[],
  count: number,
): SimCity[] {
  const cities: SimCity[] = [];
  for (let i = 0; i < count; i++) {
    const civ = civs[i % civs.length]!;
    const region =
      i < civs.length
        ? land.find((r) => r.id === civ.regionIds[0])!
        : rng.pick(land);
    const pop = rng.int(5_000, 400_000);
    region.population += Math.floor(pop * 0.3);
    if (!civ.regionIds.includes(region.id)) civ.regionIds.push(region.id);
    cities.push({
      id: `city_${i}`,
      name: `${civ.name} ${i < civs.length ? "Prime" : `Outpost ${i}`}`,
      nameAr: `${civ.nameAr} ${i < civs.length ? "العاصمة" : `مستوطنة ${i}`}`,
      regionId: region.id,
      population: pop,
      civilizationId: civ.id,
    });
  }
  return cities;
}

function assignCities(civs: SimCivilization[], cities: SimCity[]): void {
  for (const civ of civs) {
    const capital = cities.find((c) => c.civilizationId === civ.id);
    if (capital) civ.capitalCityId = capital.id;
  }
}

function spawnResources(rng: SeededRandom, land: SimRegion[], count: number): SimResource[] {
  const kinds = [
    ["Iron", "حديد"],
    ["Copper", "نحاس"],
    ["Gold", "ذهب"],
    ["Timber", "خشب"],
    ["Oil", "نفط"],
    ["Crystal", "بلورات"],
    ["Fertile Soil", "تربة خصبة"],
    ["Freshwater", "مياه عذبة"],
    ["Coal", "فحم"],
    ["Rare Earth", "أتربة نادرة"],
  ];
  return Array.from({ length: count }, (_, i) => {
    const region = land[i % land.length]!;
    const [en, ar] = kinds[i % kinds.length]!;
    return {
      id: `res_${i}`,
      name: `${en} Deposit ${i}`,
      nameAr: `مورد ${ar} ${i}`,
      regionId: region.id,
      amount: rng.float(0.2, 1),
      renewRate: rng.float(0, 0.05),
      extractRate: rng.float(0.01, 0.08),
      value: rng.float(0.2, 1),
      environmentalImpact: rng.float(0.05, 0.6),
    };
  });
}

function spawnSpecies(rng: SeededRandom, land: SimRegion[], count: number): SimSpecies[] {
  return Array.from({ length: count }, (_, i) => {
    const region = rng.pick(land);
    return {
      id: `spc_${i}`,
      name: `Species ${i}`,
      nameAr: `نوع ${i}`,
      regionIds: [region.id],
      population: rng.int(100, 50_000),
      size: rng.float(0.05, 1),
      reproduction: rng.float(0.05, 0.6),
      aggression: rng.float(0, 0.9),
      intelligence: rng.float(0.05, 0.7),
      coldResistance: rng.float(0, 1),
      heatResistance: rng.float(0, 1),
      waterNeed: rng.float(0.1, 0.9),
      foodNeed: rng.float(0.1, 0.9),
      adaptability: rng.float(0.1, 0.9),
      mutationRate: rng.float(0.01, 0.15),
      trophicLevel: rng.float(0.1, 1),
    };
  });
}

function spawnPlants(rng: SeededRandom, land: SimRegion[], count: number): SimPlant[] {
  return Array.from({ length: count }, (_, i) => {
    const region = land[i % land.length]!;
    return {
      id: `plt_${i}`,
      name: `Flora ${i}`,
      nameAr: `نبات ${i}`,
      regionIds: [region.id],
      coverage: rng.float(0.05, 0.9),
      growthRate: rng.float(0.05, 0.5),
      waterNeed: rng.float(0.1, 0.9),
      pollutionAbsorption: rng.float(0, 0.4),
      energyOutput: rng.float(0, 0.3),
      nightLuminosity: rng.float(0, 0.2),
      fertilityBoost: rng.float(0, 0.3),
    };
  });
}

function spawnTechnologies(
  rng: SeededRandom,
  civs: SimCivilization[],
  count: number,
): SimTechnology[] {
  return Array.from({ length: count }, (_, i) => {
    const [en, ar] = TECH_NAMES[i % TECH_NAMES.length]!;
    return {
      id: `tech_${i}`,
      name: en,
      nameAr: ar,
      level: Math.min(1, (i + 1) / count),
      category: rng.pick(["survival", "military", "economy", "science", "culture"]),
      discovererCivId: rng.pick(civs).id,
    };
  });
}

function bootstrapTimeline(state: WorldState, rng: SeededRandom): void {
  const milestones: Array<{
    year: number;
    type: WorldState["events"][0]["type"];
    title: string;
    titleAr: string;
    description: string;
    descriptionAr: string;
  }> = [
    {
      year: -1000,
      type: "CLIMATE_CHANGED",
      title: "Origin of Oceans",
      titleAr: "نشأة المحيطات",
      description: "Primordial waters settled into global oceans.",
      descriptionAr: "استقرت المياه الأولى مكونة المحيطات العالمية.",
    },
    {
      year: -850,
      type: "SPECIES_CREATED",
      title: "First Living Organism",
      titleAr: "أول كائن حي",
      description: "Microbial life emerged in coastal shallows.",
      descriptionAr: "ظهرت الحياة الميكروبية في المياه الساحلية الضحلة.",
    },
    {
      year: -600,
      type: "PLANT_CREATED",
      title: "Emergence of Plants",
      titleAr: "ظهور النباتات",
      description: "Photosynthetic flora colonized fertile lands.",
      descriptionAr: "استعمرت النباتات الضوئية الأراضي الخصبة.",
    },
    {
      year: -430,
      type: "CIVILIZATION_FOUNDED",
      title: "Dawn of Civilizations",
      titleAr: "بداية الحضارات",
      description: "Settled communities formed the first civilizations.",
      descriptionAr: "تشكلت المجتمعات المستقرة لتصبح أولى الحضارات.",
    },
    {
      year: -200,
      type: "TECHNOLOGY_DISCOVERED",
      title: "Discovery of Metals",
      titleAr: "اكتشاف المعادن",
      description: "Bronze and copper tools reshaped economies.",
      descriptionAr: "أعادت أدوات البرونز والنحاس تشكيل الاقتصاد.",
    },
    {
      year: -80,
      type: "WAR_STARTED",
      title: "The Great Border Wars",
      titleAr: "حروب الحدود الكبرى",
      description: "Resource rivalry ignited major conflicts.",
      descriptionAr: "أشعل التنافس على الموارد صراعات كبرى.",
    },
    {
      year: -40,
      type: "SPECIES_EXTINCT",
      title: "River Valley Extinction",
      titleAr: "انقراض وادي الأنهار",
      description: "Overhunting and climate stress ended a key species.",
      descriptionAr: "أنهى الصيد الجائر والضغط المناخي نوعًا أساسيًا.",
    },
    {
      year: -10,
      type: "TECHNOLOGY_DISCOVERED",
      title: "Technical Revolutions",
      titleAr: "الثورات التقنية",
      description: "Linked inventions accelerated social change.",
      descriptionAr: "سرّعت الاختراعات المترابطة التغير الاجتماعي.",
    },
  ];

  for (const m of milestones) {
    const region = rng.pick(state.regions.filter((r) => r.biome !== "ocean"));
    state.events.push({
      id: `evt_boot_${m.year}`,
      type: m.type,
      title: m.title,
      titleAr: m.titleAr,
      description: m.description,
      descriptionAr: m.descriptionAr,
      tick: 0,
      year: m.year,
      regionId: region.id,
      importance: 0.85,
      confidence: 1,
      causes: ["planetary_formation"],
      effects: ["timeline_marker"],
      actorIds: [],
      payload: { bootstrap: true },
    });
  }

  // Set present year after bootstrap lore
  state.year = 1247;
  state.tick = 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export const GENERATOR_TARGETS = {
  civilizations: CIV_COUNT,
  cities: CITY_COUNT,
  resources: RESOURCE_COUNT,
  species: SPECIES_COUNT,
  plants: PLANT_COUNT,
  technologies: TECH_COUNT,
  regionGrid: REGION_GRID,
};

import { GRID_SIZE } from "@planet/config";
import type { Biome } from "@planet/config";
import { FractalNoise } from "./noise.js";
import { SeededRng, hashString } from "./rng.js";
import { classifyBiome, BIOME_LABELS } from "./biomes.js";
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

const CIV_NAMES_AR = [
  "أوريشا",
  "نهرال",
  "قمران",
  "سفيرة",
  "تيلور",
  "جبالين",
  "زهرون",
  "ميراث",
  "أطلسيا",
  "وادي الضوء",
  "صحارى الريح",
  "مرافئ الشمال",
];
const CIV_NAMES_EN = [
  "Orisha",
  "Nahral",
  "Qamran",
  "Safira",
  "Tylor",
  "Jabalin",
  "Zahroun",
  "Meeras",
  "Atlasia",
  "Valley of Light",
  "Wind Deserts",
  "Northern Harbors",
];

function cellToLatLng(x: number, y: number, size: number) {
  const lat = 90 - ((y + 0.5) / size) * 180;
  const lng = ((x + 0.5) / size) * 360 - 180;
  return { lat, lng };
}

export interface GenerateOptions {
  planetId: string;
  seed: number;
  gridSize?: number;
  civilizationTarget?: number;
  cityTarget?: number;
  resourceTarget?: number;
  speciesTarget?: number;
  plantTarget?: number;
  techTarget?: number;
}

export function generateWorld(options: GenerateOptions): WorldState {
  const size = options.gridSize ?? GRID_SIZE;
  const rng = new SeededRng(options.seed);
  const heightNoise = new FractalNoise(options.seed);
  const moistNoise = new FractalNoise(options.seed ^ 0x9e3779b9);
  const tempNoise = new FractalNoise(options.seed ^ 0x85ebca6b);

  const regions: SimRegion[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const { lat, lng } = cellToLatLng(x, y, size);
      const elevation = (heightNoise.fbm(nx * 4, ny * 4) + 1) / 2;
      const moisture = (moistNoise.fbm(nx * 5, ny * 5) + 1) / 2;
      const latFactor = 1 - Math.abs(lat) / 90;
      const temperature = Math.min(
        1,
        Math.max(
          0,
          latFactor * 0.75 +
            ((tempNoise.fbm(nx * 3, ny * 3) + 1) / 2) * 0.35 -
            elevation * 0.25,
        ),
      );
      const biome = classifyBiome(elevation, temperature, moisture, lat);
      const fertility =
        biome === "ocean" || biome === "ice"
          ? 0
          : Math.min(1, moisture * 0.55 + (1 - Math.abs(elevation - 0.45)) * 0.45);
      const carrying =
        biome === "ocean"
          ? 0
          : Math.floor(2000 + fertility * 18000 + moisture * 8000);
      const id = `reg_${options.seed.toString(16)}_${x}_${y}`;
      const label = BIOME_LABELS[biome];
      regions.push({
        id,
        name: `${label.ar} ${x},${y}`,
        nameEn: `${label.en} ${x},${y}`,
        x,
        y,
        lat,
        lng,
        elevation,
        temperature,
        moisture,
        fertility,
        pollution: rng.next() * 0.08,
        population: 0,
        carryingCapacity: carrying,
        biome,
        resourceIds: [],
        speciesIds: [],
        plantIds: [],
      });
    }
  }

  const land = regions.filter((r) => r.biome !== "ocean");
  const habitable = land.filter(
    (r) => !["ice", "volcanic", "mountain"].includes(r.biome) || r.fertility > 0.35,
  );

  const resources: SimResource[] = [];
  const resourceTarget = options.resourceTarget ?? 120;
  for (let i = 0; i < resourceTarget; i++) {
    const region = rng.pick(land);
    const id = `res_${options.seed}_${i}`;
    const kinds = [
      ["نحاس", "Copper"],
      ["حديد", "Iron"],
      ["خشب نادر", "Rare Timber"],
      ["بلورات طاقة", "Energy Crystals"],
      ["مياه عذبة", "Fresh Water"],
      ["فحم", "Coal"],
      ["ذهب", "Gold"],
      ["حجر بركاني", "Volcanic Stone"],
    ] as const;
    const kind = rng.pick(kinds);
    resources.push({
      id,
      name: `${kind[0]} ${i + 1}`,
      nameEn: `${kind[1]} ${i + 1}`,
      regionId: region.id,
      quantity: 500 + rng.nextInt(0, 5000),
      renewal: rng.next() * 0.15,
      value: 0.2 + rng.next() * 0.8,
      extraction: rng.next() * 0.2,
      environmentalImpact: rng.next() * 0.4,
    });
    region.resourceIds.push(id);
  }

  const plants: SimPlant[] = [];
  const plantTarget = options.plantTarget ?? 800;
  const plantBiomes: Biome[] = [
    "rainforest",
    "temperate_forest",
    "plains",
    "wetland",
    "steppe",
    "coast",
  ];
  for (let i = 0; i < plantTarget; i++) {
    const preferred = [rng.pick(plantBiomes)];
    if (rng.chance(0.3)) preferred.push(rng.pick(plantBiomes));
    plants.push({
      id: `plt_${options.seed}_${i}`,
      name: `نبات ${i + 1}`,
      nameEn: `Plant ${i + 1}`,
      coverage: rng.next() * 0.4,
      growthRate: 0.05 + rng.next() * 0.35,
      waterNeed: rng.next(),
      pollutionAbsorption: rng.next() * 0.3,
      luminosity: rng.next() * 0.2,
      preferredBiomes: preferred,
    });
  }

  const species: SimSpecies[] = [];
  const speciesTarget = options.speciesTarget ?? 300;
  for (let i = 0; i < speciesTarget; i++) {
    const preferred = [rng.pick(plantBiomes.concat(["tundra", "desert", "mountain"]))];
    species.push({
      id: `spc_${options.seed}_${i}`,
      name: `مخلوق ${i + 1}`,
      nameEn: `Creature ${i + 1}`,
      population: rng.nextInt(50, 5000),
      size: rng.next(),
      reproduction: 0.05 + rng.next() * 0.4,
      aggression: rng.next(),
      intelligence: rng.next(),
      heatResistance: rng.next(),
      coldResistance: rng.next(),
      waterNeed: rng.next(),
      adaptability: rng.next(),
      preferredBiomes: preferred,
      preyOf: [],
      foodOf: [],
    });
  }
  // simple food web links
  for (let i = 0; i < species.length; i++) {
    if (rng.chance(0.35)) {
      const predator = species[i]!;
      const prey = species[rng.nextInt(0, species.length - 1)]!;
      if (predator.id !== prey.id) {
        predator.foodOf.push(prey.id);
        prey.preyOf.push(predator.id);
      }
    }
  }

  const civCount = options.civilizationTarget ?? 12;
  const civilizations: SimCivilization[] = [];
  const cities: SimCity[] = [];
  const usedRegions = new Set<string>();
  for (let i = 0; i < civCount; i++) {
    let capital = rng.pick(habitable);
    let guard = 0;
    while (usedRegions.has(capital.id) && guard++ < 50) {
      capital = rng.pick(habitable);
    }
    usedRegions.add(capital.id);
    const civId = `civ_${options.seed}_${i}`;
    const pop = rng.nextInt(8000, 120000);
    capital.population = Math.min(capital.carryingCapacity, Math.floor(pop * 0.35));
    capital.civilizationId = civId;
    civilizations.push({
      id: civId,
      name: CIV_NAMES_AR[i] ?? `حضارة ${i + 1}`,
      nameEn: CIV_NAMES_EN[i] ?? `Civilization ${i + 1}`,
      population: pop,
      techLevel: 0.15 + rng.next() * 0.55,
      military: rng.next(),
      economy: rng.next(),
      food: 0.4 + rng.next() * 0.5,
      stability: 0.35 + rng.next() * 0.55,
      aggression: rng.next() * 0.7,
      innovation: rng.next(),
      happiness: 0.3 + rng.next() * 0.5,
      pollution: rng.next() * 0.35,
      education: rng.next(),
      capitalRegionId: capital.id,
      cityIds: [],
      allyIds: [],
      enemyIds: [],
      memory: [],
    });
  }

  const cityTarget = options.cityTarget ?? 40;
  for (let i = 0; i < cityTarget; i++) {
    const civ = civilizations[i % civilizations.length]!;
    const region = rng.pick(habitable);
    const cityId = `city_${options.seed}_${i}`;
    const cityPop = rng.nextInt(500, 25000);
    region.population = Math.min(
      region.carryingCapacity,
      region.population + cityPop,
    );
    region.civilizationId = civ.id;
    cities.push({
      id: cityId,
      name: `مدينة ${i + 1}`,
      nameEn: `City ${i + 1}`,
      civilizationId: civ.id,
      regionId: region.id,
      population: cityPop,
    });
    civ.cityIds.push(cityId);
  }

  const technologies: SimTechnology[] = [];
  const techTarget = options.techTarget ?? 50;
  const techNames = [
    ["الزراعة", "Agriculture"],
    ["الكتابة", "Writing"],
    ["البرونز", "Bronze"],
    ["الملاحة", "Navigation"],
    ["الطاقة الشمسية", "Solar Energy"],
    ["الطب العشبي", "Herbal Medicine"],
  ] as const;
  for (let i = 0; i < techTarget; i++) {
    const base = techNames[i % techNames.length]!;
    const holders = civilizations
      .filter(() => rng.chance(0.35))
      .map((c) => c.id);
    technologies.push({
      id: `tech_${options.seed}_${i}`,
      name: `${base[0]} ${Math.floor(i / techNames.length) + 1}`,
      nameEn: `${base[1]} ${Math.floor(i / techNames.length) + 1}`,
      level: 0.1 + rng.next() * 0.9,
      civilizationIds: holders.length ? holders : [rng.pick(civilizations).id],
    });
  }

  // attach some species/plants to regions
  for (const region of land) {
    for (let k = 0; k < 3; k++) {
      const sp = rng.pick(species);
      if (sp.preferredBiomes.includes(region.biome) || rng.chance(0.15)) {
        region.speciesIds.push(sp.id);
      }
      const pl = rng.pick(plants);
      if (pl.preferredBiomes.includes(region.biome) || rng.chance(0.2)) {
        region.plantIds.push(pl.id);
      }
    }
  }

  return {
    planetId: options.planetId,
    seed: options.seed,
    tick: 0,
    year: 0,
    tickUnit: "year",
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
    alliances: [],
    diseases: [],
    eventLog: [
      {
        id: `evt_origin_${options.seed}`,
        type: "CLIMATE_CHANGED",
        title: "نشأة المحيطات",
        titleEn: "Origin of Oceans",
        summary: "تشكّلت المحيطات الأولى وبرد سطح الكوكب بما يكفي للحياة.",
        summaryEn: "The first oceans formed and the surface cooled enough for life.",
        tick: 0,
        year: 0,
        importance: 1,
        causes: ["planetary_formation"],
        effects: [],
        confidence: 1,
        createdAt: new Date(0).toISOString(),
      },
    ],
    contributions: [],
  };
}

export function worldFingerprint(state: WorldState): string {
  const payload = [
    state.seed,
    state.tick,
    state.civilizations.length,
    state.species.reduce((a, s) => a + s.population, 0),
    state.regions.reduce((a, r) => a + Math.round(r.pollution * 1000), 0),
    state.wars.filter((w) => w.active).length,
  ].join("|");
  return hashString(payload).toString(16);
}

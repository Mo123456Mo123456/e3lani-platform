/**
 * Deterministic seed for كوكب يولد أمامك
 * Creates sandbox users + a living planet with civilizations, species, plants, resources, events.
 */
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  BiomeType,
  ElementCategory,
  PrismaClient,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();
const PLANET_SEED = process.env.DEFAULT_PLANET_SEED ?? "planet-born-alpha-2026";

const BIOMES: BiomeType[] = [
  "ocean",
  "coast",
  "plains",
  "rainforest",
  "temperate_forest",
  "desert",
  "mountain",
  "tundra",
  "wetland",
  "steppe",
  "volcanic",
  "ice",
];

function hashSeed(parts: Array<string | number>): number {
  const h = createHash("sha256").update(parts.join("|")).digest();
  return h.readUInt32BE(0) / 0xffffffff;
}

function pick<T>(seed: string, key: string, arr: T[]): T {
  return arr[Math.floor(hashSeed([seed, key]) * arr.length)]!;
}

function seededInt(seed: string, key: string, min: number, max: number): number {
  return Math.floor(hashSeed([seed, key]) * (max - min + 1)) + min;
}

function classifyBiome(lat: number, elev: number, temp: number, moist: number): BiomeType {
  if (elev < 0.28) return "ocean";
  if (elev < 0.34) return "coast";
  if (Math.abs(lat) > 70) return "ice";
  if (Math.abs(lat) > 58 && temp < 0.35) return "tundra";
  if (elev > 0.78) return elev > 0.9 && moist < 0.35 ? "volcanic" : "mountain";
  if (temp > 0.7 && moist < 0.28) return "desert";
  if (temp > 0.65 && moist > 0.7) return "rainforest";
  if (moist > 0.65 && temp > 0.4) return "temperate_forest";
  if (moist > 0.7) return "wetland";
  if (moist < 0.4 && temp > 0.45) return "steppe";
  return "plains";
}

const CIV_NAMES = [
  ["Aurora Reach", "أفق الشفق"],
  ["Verdant Compact", "ميثاق الخضرة"],
  ["Iron Coast", "ساحل الحديد"],
  ["Sand Concord", "وفاق الرمال"],
  ["Glacier League", "رابطة الجليد"],
  ["Delta Commons", "مشترك الدلتا"],
  ["Obsidian Throne", "عرش السبج"],
  ["Windward Guild", "نقابة مهب الريح"],
  ["Coral Sovereignty", "سيادة المرجان"],
  ["Highsteppe Khanate", "خانية الهضاب"],
  ["Lumen Archive", "أرشيف النور"],
  ["Rootbound Conclave", "مجمع الجذور"],
];

async function main() {
  console.log("Seeding planet-born database...");

  const adminPass = await bcrypt.hash(
    process.env.SANDBOX_ADMIN_PASSWORD ?? "PlanetAdmin!2026",
    10,
  );
  const userPass = await bcrypt.hash(
    process.env.SANDBOX_USER_PASSWORD ?? "Explorer!2026",
    10,
  );

  const admin = await prisma.user.upsert({
    where: { email: process.env.SANDBOX_ADMIN_EMAIL ?? "admin@planet-born.local" },
    update: {},
    create: {
      email: process.env.SANDBOX_ADMIN_EMAIL ?? "admin@planet-born.local",
      passwordHash: adminPass,
      displayName: "Super Admin",
      role: UserRole.super_admin,
      level: 99,
      xp: 99999,
      locale: "ar",
      profile: { create: { title: "Simulation Overseer", bio: "Sandbox super admin" } },
    },
  });

  const explorer = await prisma.user.upsert({
    where: { email: process.env.SANDBOX_USER_EMAIL ?? "explorer@planet-born.local" },
    update: {},
    create: {
      email: process.env.SANDBOX_USER_EMAIL ?? "explorer@planet-born.local",
      passwordHash: userPass,
      displayName: "Planet Explorer",
      role: UserRole.explorer,
      level: 7,
      xp: 4200,
      locale: "ar",
      profile: { create: { title: "Planet Explorer", bio: "Sandbox explorer account" } },
    },
  });

  // Reset planet for idempotent seed of world content
  const existing = await prisma.planet.findUnique({ where: { seed: PLANET_SEED } });
  if (existing) {
    await prisma.planet.delete({ where: { id: existing.id } });
  }

  const resLat = 36;
  const resLon = 72;

  const planet = await prisma.planet.create({
    data: {
      name: "Aurora Prime",
      nameAr: "أورورا برايم",
      seed: PLANET_SEED,
      currentTick: 1200,
      currentYear: 1200,
      tickUnit: "year",
      resolutionLat: resLat,
      resolutionLon: resLon,
      status: "active",
    },
  });

  const regionRows: Array<{
    id?: string;
    planetId: string;
    name: string;
    nameAr: string;
    biome: BiomeType;
    lat: number;
    lon: number;
    elevation: number;
    temperature: number;
    moisture: number;
    fertility: number;
    population: number;
    pollution: number;
    gridX: number;
    gridY: number;
  }> = [];

  for (let y = 0; y < resLat; y++) {
    for (let x = 0; x < resLon; x++) {
      const lat = (y / (resLat - 1)) * 180 - 90;
      const lon = (x / (resLon - 1)) * 360 - 180;
      const elev = hashSeed([PLANET_SEED, "h", x, y]);
      const moist = hashSeed([PLANET_SEED, "m", x, y]);
      const temp =
        0.55 -
        Math.abs(lat) / 180 +
        (elev - 0.5) * -0.25 +
        (hashSeed([PLANET_SEED, "t", x, y]) - 0.5) * 0.1;
      const biome = classifyBiome(lat, elev, temp, moist);
      if (biome === "ocean" && hashSeed([PLANET_SEED, "skip", x, y]) > 0.15) {
        // keep oceans but we still store a sampling of land-heavy cells for UI
      }
      // Store every Nth ocean cell + all land for performance
      if (biome === "ocean" && (x + y) % 4 !== 0) continue;

      regionRows.push({
        planetId: planet.id,
        name: `Sector ${x}-${y}`,
        nameAr: `قطاع ${x}-${y}`,
        biome,
        lat,
        lon,
        elevation: elev,
        temperature: temp,
        moisture: moist,
        fertility: Math.max(0, moist * (1 - Math.abs(elev - 0.45))),
        population: biome === "ocean" ? 0 : seededInt(PLANET_SEED, `pop-${x}-${y}`, 0, 80000),
        pollution: hashSeed([PLANET_SEED, "p", x, y]) * 0.35,
        gridX: x,
        gridY: y,
      });
    }
  }

  // Batch create regions
  const createdRegions = [];
  for (let i = 0; i < regionRows.length; i += 100) {
    const chunk = regionRows.slice(i, i + 100);
    await prisma.planetRegion.createMany({ data: chunk });
  }
  const regions = await prisma.planetRegion.findMany({ where: { planetId: planet.id } });
  createdRegions.push(...regions);

  const landRegions = createdRegions.filter((r) => r.biome !== "ocean");
  const civRegions: string[] = [];

  for (let i = 0; i < 12; i++) {
    const [name, nameAr] = CIV_NAMES[i]!;
    const base = landRegions[seededInt(PLANET_SEED, `civ-region-${i}`, 0, landRegions.length - 1)]!;
    const civ = await prisma.civilization.create({
      data: {
        planetId: planet.id,
        name,
        nameAr,
        population: seededInt(PLANET_SEED, `civ-pop-${i}`, 80000, 2500000),
        techLevel: hashSeed([PLANET_SEED, `tech-${i}`]),
        military: hashSeed([PLANET_SEED, `mil-${i}`]),
        economy: hashSeed([PLANET_SEED, `eco-${i}`]),
        stability: 0.4 + hashSeed([PLANET_SEED, `stab-${i}`]) * 0.5,
        happiness: 0.35 + hashSeed([PLANET_SEED, `hap-${i}`]) * 0.5,
        education: hashSeed([PLANET_SEED, `edu-${i}`]),
        pollution: hashSeed([PLANET_SEED, `civp-${i}`]) * 0.5,
        innovation: hashSeed([PLANET_SEED, `inn-${i}`]),
        aggression: hashSeed([PLANET_SEED, `agg-${i}`]),
        color: `hsl(${Math.floor(hashSeed([PLANET_SEED, `col-${i}`]) * 360)} 70% 55%)`,
        government: pick(PLANET_SEED, `gov-${i}`, [
          "republic",
          "monarchy",
          "council",
          "theocracy",
          "federation",
        ]),
        foundedTick: seededInt(PLANET_SEED, `found-${i}`, 200, 900),
        memoryJson: { rivalries: [], alliances: [] },
      },
    });
    civRegions.push(base.id);

    await prisma.planetRegion.update({
      where: { id: base.id },
      data: { civilizationId: civ.id, population: Math.max(base.population, 50000) },
    });

    // 3-4 cities each → ~40 cities
    const cityCount = 3 + (i % 2);
    for (let c = 0; c < cityCount; c++) {
      const region =
        landRegions[seededInt(PLANET_SEED, `city-${i}-${c}`, 0, landRegions.length - 1)]!;
      await prisma.city.create({
        data: {
          civilizationId: civ.id,
          regionId: region.id,
          name: `${name} ${c === 0 ? "Capital" : `Outpost ${c}`}`,
          nameAr: `${nameAr} ${c === 0 ? "العاصمة" : `موقع ${c}`}`,
          population: seededInt(PLANET_SEED, `cpop-${i}-${c}`, 5000, 400000),
          prosperity: hashSeed([PLANET_SEED, `pros-${i}-${c}`]),
          defense: hashSeed([PLANET_SEED, `def-${i}-${c}`]),
          foundedTick: seededInt(PLANET_SEED, `cf-${i}-${c}`, 300, 1100),
        },
      });
    }
  }

  // 120 resources
  const resourceTypes = [
    ["Iron", "حديد", "metal"],
    ["Timber", "خشب", "organic"],
    ["Crystal", "بلور", "rare"],
    ["Grain", "حبوب", "food"],
    ["Oil", "نفط", "energy"],
    ["Freshwater", "مياه عذبة", "water"],
  ];
  const resourceData = Array.from({ length: 120 }, (_, i) => {
    const [name, nameAr, category] = resourceTypes[i % resourceTypes.length]!;
    const region = landRegions[i % landRegions.length]!;
    return {
      planetId: planet.id,
      regionId: region.id,
      name: `${name} Deposit ${i + 1}`,
      nameAr: `مكمن ${nameAr} ${i + 1}`,
      quantity: 100 + hashSeed([PLANET_SEED, `rq-${i}`]) * 9000,
      regenerate: hashSeed([PLANET_SEED, `rr-${i}`]) * 0.2,
      extractRate: hashSeed([PLANET_SEED, `re-${i}`]) * 0.3,
      value: 1 + hashSeed([PLANET_SEED, `rv-${i}`]) * 50,
      envImpact: hashSeed([PLANET_SEED, `ri-${i}`]) * 0.4,
      category,
      createdTick: seededInt(PLANET_SEED, `rt-${i}`, 1, 1000),
    };
  });
  await prisma.resource.createMany({ data: resourceData });

  // 300 species
  const speciesData = Array.from({ length: 300 }, (_, i) => ({
    planetId: planet.id,
    name: `Species ${i + 1}`,
    nameAr: `نوع ${i + 1}`,
    population: 100 + hashSeed([PLANET_SEED, `sp-${i}`]) * 50000,
    size: hashSeed([PLANET_SEED, `ss-${i}`]),
    reproduction: hashSeed([PLANET_SEED, `sr-${i}`]),
    aggression: hashSeed([PLANET_SEED, `sa-${i}`]),
    intelligence: hashSeed([PLANET_SEED, `si-${i}`]),
    heatResistance: hashSeed([PLANET_SEED, `sh-${i}`]),
    coldResistance: hashSeed([PLANET_SEED, `sc-${i}`]),
    waterNeed: hashSeed([PLANET_SEED, `sw-${i}`]),
    adaptability: hashSeed([PLANET_SEED, `sd-${i}`]),
    mutationRate: hashSeed([PLANET_SEED, `sm-${i}`]) * 0.2,
    habitatBiomes: [pick(PLANET_SEED, `sb-${i}`, BIOMES.filter((b) => b !== "ocean"))],
    preyOf: [] as string[],
    foodOf: [] as string[],
    status: "alive",
    createdTick: seededInt(PLANET_SEED, `st-${i}`, 50, 1100),
  }));
  for (let i = 0; i < speciesData.length; i += 100) {
    await prisma.species.createMany({ data: speciesData.slice(i, i + 100) });
  }

  // 800 plants
  const plantData = Array.from({ length: 800 }, (_, i) => ({
    planetId: planet.id,
    name: `Flora ${i + 1}`,
    nameAr: `نبات ${i + 1}`,
    coverage: hashSeed([PLANET_SEED, `pc-${i}`]),
    growthRate: hashSeed([PLANET_SEED, `pg-${i}`]),
    waterNeed: hashSeed([PLANET_SEED, `pw-${i}`]),
    pollutionAbsorption: hashSeed([PLANET_SEED, `ppa-${i}`]) * 0.5,
    nightLuminosity: hashSeed([PLANET_SEED, `pnl-${i}`]) * 0.3,
    energyOutput: hashSeed([PLANET_SEED, `pe-${i}`]) * 0.4,
    habitatBiomes: [
      pick(
        PLANET_SEED,
        `pb-${i}`,
        BIOMES.filter((b) => !["ocean", "ice"].includes(b)),
      ),
    ],
    status: "thriving",
    createdTick: seededInt(PLANET_SEED, `pt-${i}`, 20, 1100),
  }));
  for (let i = 0; i < plantData.length; i += 100) {
    await prisma.plant.createMany({ data: plantData.slice(i, i + 100) });
  }

  // 50 technologies
  await prisma.technology.createMany({
    data: Array.from({ length: 50 }, (_, i) => ({
      planetId: planet.id,
      name: `Technology ${i + 1}`,
      nameAr: `تقنية ${i + 1}`,
      level: hashSeed([PLANET_SEED, `tl-${i}`]),
      category: pick(PLANET_SEED, `tc-${i}`, [
        "agriculture",
        "energy",
        "warfare",
        "medicine",
        "transport",
        "computing",
      ]),
      discoveredTick: seededInt(PLANET_SEED, `tt-${i}`, 100, 1190),
    })),
  });

  // Timeline snapshots + world events
  const milestones = [
    { tick: 0, year: 0, label: "Formation of Oceans", labelAr: "تشكّل المحيطات" },
    { tick: 150, year: 150, label: "First Living Organism", labelAr: "أول كائن حي" },
    { tick: 350, year: 350, label: "Appearance of Plants", labelAr: "ظهور النباتات" },
    { tick: 600, year: 600, label: "Start of Stone Age", labelAr: "بداية العصر الحجري" },
    { tick: 900, year: 900, label: "Invention of Bronze", labelAr: "اختراع البرونز" },
    { tick: 1100, year: 1100, label: "Trade Networks", labelAr: "شبكات التجارة" },
    { tick: 1180, year: 1180, label: "Severe Rainstorm", labelAr: "عاصفة مطيرة شديدة" },
    { tick: 1195, year: 1195, label: "New Marine Creature", labelAr: "مخلوق بحري جديد" },
  ];

  for (const m of milestones) {
    await prisma.timelineSnapshot.create({
      data: {
        planetId: planet.id,
        tick: m.tick,
        year: m.year,
        label: m.label,
        labelAr: m.labelAr,
        stateJson: { landmark: true },
      },
    });
    await prisma.worldEvent.create({
      data: {
        planetId: planet.id,
        type: m.tick < 600 ? "CLIMATE_CHANGED" : "TECHNOLOGY_DISCOVERED",
        title: m.label,
        titleAr: m.labelAr,
        description: `${m.label} reshaped the world trajectory.`,
        descriptionAr: `${m.labelAr} أعاد تشكيل مسار العالم.`,
        tick: m.tick,
        year: m.year,
        importance: 0.7 + hashSeed([PLANET_SEED, m.label]) * 0.3,
        lat: landRegions[m.tick % landRegions.length]!.lat,
        lon: landRegions[m.tick % landRegions.length]!.lon,
        regionId: landRegions[m.tick % landRegions.length]!.id,
        causeIds: ["seed-history"],
        confidence: 1,
        directImpact: { history: 1 },
      },
    });
  }

  // Additional live-feed style events
  const liveEvents = [
    {
      type: "SPECIES_CREATED",
      title: "New marine species appears",
      titleAr: "ظهور نوع بحري جديد",
      description: "A luminous reef fish adapted to warmer currents.",
      descriptionAr: "سمكة شعاب مضيئة تكيّفت مع التيارات الأدفأ.",
    },
    {
      type: "CIVILIZATION_FOUNDED",
      title: "River valley settlement grows",
      titleAr: "نمو مستوطنة في وادي النهر",
      description: "Farmers organized irrigation councils.",
      descriptionAr: "نظّم المزارعون مجالس للري.",
    },
    {
      type: "TECHNOLOGY_DISCOVERED",
      title: "Bronze manufacturing discovered",
      titleAr: "اكتشاف صناعة البرونز",
      description: "Alloy workshops boosted tools and trade.",
      descriptionAr: "ورش السبائك عززت الأدوات والتجارة.",
    },
    {
      type: "CLIMATE_CHANGED",
      title: "Sandstorm front expands",
      titleAr: "توسع جبهة عاصفة رملية",
      description: "Arid winds reduced fertility along the steppe.",
      descriptionAr: "قلّلت الرياح الجافة خصوبة السهوب.",
    },
    {
      type: "MIGRATION_STARTED",
      title: "Tribal migration begins",
      titleAr: "بداية هجرة قبلية",
      description: "Clans move toward wetter coasts.",
      descriptionAr: "تنتقل العشائر نحو السواحل الأكثر رطوبة.",
    },
  ];

  for (let i = 0; i < liveEvents.length; i++) {
    const e = liveEvents[i]!;
    const region = landRegions[seededInt(PLANET_SEED, `ev-${i}`, 0, landRegions.length - 1)]!;
    await prisma.worldEvent.create({
      data: {
        planetId: planet.id,
        type: e.type,
        title: e.title,
        titleAr: e.titleAr,
        description: e.description,
        descriptionAr: e.descriptionAr,
        tick: 1190 + i,
        year: 1190 + i,
        importance: 0.55 + i * 0.05,
        lat: region.lat,
        lon: region.lon,
        regionId: region.id,
        causeIds: ["climate", "resources"],
        confidence: 0.9,
        directImpact: { index: i },
      },
    });
  }

  // Demo contribution for explorer
  const demoRegion = landRegions[0]!;
  const contribution = await prisma.userContribution.create({
    data: {
      planetId: planet.id,
      userId: explorer.id,
      category: ElementCategory.plant,
      name: "Giant Light Tree",
      nameAr: "شجرة الضوء العملاقة",
      description: "A tall tree that absorbs pollution and glows at night.",
      traitsJson: {
        size: 0.85,
        growthRate: 0.35,
        waterNeed: 0.7,
        pollutionAbsorption: 0.8,
        nightLuminosity: 0.75,
        heatResistance: 0.65,
        coldResistance: 0.4,
      },
      biomes: ["rainforest", "temperate_forest"],
      risks: ["high_water_consumption", "ecosystem_competition"],
      benefits: ["pollution_reduction", "night_visibility"],
      balanceScore: 0.78,
      wasBalanced: true,
      regionId: demoRegion.id,
      lat: demoRegion.lat,
      lon: demoRegion.lon,
      status: "applied",
      appliedTick: 1198,
      narrativeAr:
        "بدأت شجرة الضوء بالانتشار في الغابات الجنوبية وساهمت في خفض التلوث مع استهلاك ملحوظ للمياه.",
      narrativeEn:
        "The light tree began spreading in southern forests, cutting pollution while raising water demand.",
      causalGraphJson: {
        nodes: [
          { id: "c1", label: "Light Tree", kind: "cause", magnitude: 1, confidence: 1, tickOffset: 0 },
          {
            id: "d1",
            label: "Pollution ↓",
            kind: "direct",
            magnitude: 0.18,
            confidence: 0.9,
            tickOffset: 1,
          },
          {
            id: "s1",
            label: "Water competition",
            kind: "secondary",
            magnitude: 0.22,
            confidence: 0.85,
            tickOffset: 5,
          },
        ],
        edges: [
          { from: "c1", to: "d1", relation: "reduces", weight: 0.8 },
          { from: "c1", to: "s1", relation: "increases", weight: 0.6 },
        ],
      },
    },
  });

  await prisma.worldEvent.create({
    data: {
      planetId: planet.id,
      type: "CONTRIBUTION_APPLIED",
      title: "Explorer planted the Giant Light Tree",
      titleAr: "المستكشف زرع شجرة الضوء العملاقة",
      description: "A balanced plant contribution entered the living world.",
      descriptionAr: "دخلت مساهمة نباتية متوازنة إلى العالم الحي.",
      tick: 1198,
      year: 1198,
      importance: 0.92,
      lat: demoRegion.lat,
      lon: demoRegion.lon,
      regionId: demoRegion.id,
      causeIds: [contribution.id],
      contributionId: contribution.id,
      userId: explorer.id,
      confidence: 1,
      directImpact: { pollution: -0.18, waterStress: 0.22 },
    },
  });

  await prisma.notification.create({
    data: {
      userId: explorer.id,
      title: "Your plant reduced pollution",
      titleAr: "نباتك خفّض التلوث",
      body: "Southern forests show cleaner air after your contribution.",
      bodyAr: "تُظهر الغابات الجنوبية هواءً أنظف بعد مساهمتك.",
      kind: "contribution_impact",
      metaJson: { contributionId: contribution.id },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "SEED_DATABASE",
      entityType: "Planet",
      entityId: planet.id,
      metaJson: { seed: PLANET_SEED },
    },
  });

  const counts = {
    regions: await prisma.planetRegion.count({ where: { planetId: planet.id } }),
    civilizations: await prisma.civilization.count({ where: { planetId: planet.id } }),
    cities: await prisma.city.count({
      where: { civilization: { planetId: planet.id } },
    }),
    resources: await prisma.resource.count({ where: { planetId: planet.id } }),
    species: await prisma.species.count({ where: { planetId: planet.id } }),
    plants: await prisma.plant.count({ where: { planetId: planet.id } }),
    technologies: await prisma.technology.count({ where: { planetId: planet.id } }),
    events: await prisma.worldEvent.count({ where: { planetId: planet.id } }),
  };

  console.log("Seed complete:", {
    planetId: planet.id,
    seed: PLANET_SEED,
    admin: admin.email,
    explorer: explorer.email,
    counts,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

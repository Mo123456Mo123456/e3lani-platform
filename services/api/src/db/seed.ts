/**
 * Seed data for كوكب يولد أمامك
 *
 * Super Admin credentials (bcrypt-hashed below):
 *   email:    admin@planet.local
 *   password: Admin@Planet2026!
 *
 * Demo user:
 *   email:    explorer@planet.local
 *   password: Explorer@123
 */
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb, getSqlitePath } from './client.js';
import { runMigrations } from './migrate.js';
import * as s from './schema.js';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ROLE_DEFS = [
  { name: 'visitor', level: 0, description: 'Anonymous visitor' },
  { name: 'user', level: 10, description: 'Registered user' },
  { name: 'explorer', level: 20, description: 'Planet explorer' },
  { name: 'life_maker', level: 30, description: 'Can create species/plants' },
  { name: 'civ_creator', level: 40, description: 'Can create civilizations' },
  { name: 'historian', level: 50, description: 'Timeline curator' },
  { name: 'content_mod', level: 60, description: 'Content moderator' },
  { name: 'sim_manager', level: 70, description: 'Simulation manager' },
  { name: 'admin', level: 80, description: 'Administrator' },
  { name: 'super_admin', level: 100, description: 'Super administrator' },
] as const;

const CIV_NAMES = [
  'أوراليس', 'فيناريا', 'كاشيمار', 'ثالاسيان', 'نورفيد',
  'إيليثرا', 'سافيون', 'دراكونيس', 'ميرونيان', 'لومينا',
  'أستراليس', 'فيلكس',
];

const TECH_NAMES = [
  'النار', 'العجلة', 'الزراعة', 'الكتابة', 'الملاحة',
  'البرونز', 'الحديد', 'الطباعة', 'البخار', 'الكهرباء',
  'الراديو', 'الحاسوب', 'الطاقة النووية', 'الفضاء', 'البيوتقنية',
  'الذكاء الاصطناعي', 'الطاقة المتجددة', 'الطب الجيني', 'الواقع المعزز', 'النانو',
  'التعدين العميق', 'الري الذكي', 'الفلك', 'الكيمياء', 'الفيزياء',
  'الهندسة المعمارية', 'الموسيقى', 'القانون', 'التجارة', 'الدبلوماسية',
  'الحرب المنظمة', 'الدفاع الصاروخي', 'الطيران', 'الغواصات', 'القطارات',
  'الإنترنت', 'التشفير', 'الروبوتات', 'الاستنساخ', 'الاستدامة',
  'الهيدروليكا', 'الزجاج', 'الورق', 'البوصلة', 'الساعة',
  'التلسكوب', 'المجهر', 'اللقاح', 'المضادات الحيوية', 'الطاقة الشمسية',
];

const BIOME_DEFS = [
  { name: 'غابة استوائية', code: 'tropical_forest', color: '#228B22', habitability: 0.9 },
  { name: 'صحراء', code: 'desert', color: '#EDC9AF', habitability: 0.2 },
  { name: 'تندرا', code: 'tundra', color: '#B0C4DE', habitability: 0.25 },
  { name: 'سافانا', code: 'savanna', color: '#C2B280', habitability: 0.7 },
  { name: 'جبال', code: 'mountains', color: '#808080', habitability: 0.35 },
  { name: 'سواحل', code: 'coastal', color: '#20B2AA', habitability: 0.85 },
  { name: 'مستنقعات', code: 'wetland', color: '#556B2F', habitability: 0.55 },
  { name: 'سهول', code: 'plains', color: '#9ACD32', habitability: 0.8 },
];

const RESOURCE_TYPES = ['mineral', 'organic', 'energy', 'water', 'rare'] as const;

export async function seed(dbPath?: string) {
  if (dbPath) process.env.SQLITE_PATH = dbPath;
  runMigrations(dbPath);
  const db = getDb();

  const existing = await db.select().from(s.planets).where(eq(s.planets.seed, 'genesis-alpha-2026')).limit(1);
  if (existing.length) {
    console.log('Seed already applied (planet genesis-alpha-2026 exists). Skipping.');
    return { planetId: existing[0]!.id, skipped: true };
  }

  const rng = mulberry32(hashSeed('genesis-alpha-2026'));
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)]!;

  // Roles
  const roleIds = new Map<string, string>();
  for (const r of ROLE_DEFS) {
    const id = nanoid();
    roleIds.set(r.name, id);
    await db.insert(s.roles).values({ id, name: r.name, description: r.description, level: r.level });
  }

  // Super Admin: admin@planet.local / Admin@Planet2026!
  const adminHash = await bcrypt.hash('Admin@Planet2026!', 10);
  const adminId = nanoid();
  await db.insert(s.users).values({
    id: adminId,
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@planet.local',
    passwordHash: adminHash,
    displayName: 'Super Admin',
  });
  await db.insert(s.profiles).values({ id: nanoid(), userId: adminId, bio: 'منصة كوكب يولد أمامك', locale: 'ar' });
  await db.insert(s.userRoles).values({ id: nanoid(), userId: adminId, roleId: roleIds.get('super_admin')! });

  // Demo explorer
  const explorerHash = await bcrypt.hash('Explorer@123', 10);
  const explorerId = nanoid();
  await db.insert(s.users).values({
    id: explorerId,
    email: 'explorer@planet.local',
    passwordHash: explorerHash,
    displayName: 'مستكشف تجريبي',
  });
  await db.insert(s.profiles).values({ id: nanoid(), userId: explorerId, bio: 'مستكشف الكوكب الأول', locale: 'ar' });
  await db.insert(s.userRoles).values({ id: nanoid(), userId: explorerId, roleId: roleIds.get('explorer')! });
  await db.insert(s.userRoles).values({ id: nanoid(), userId: explorerId, roleId: roleIds.get('life_maker')! });

  // Planet
  const planetId = nanoid();
  await db.insert(s.planets).values({
    id: planetId,
    name: 'ألفا التكوين',
    seed: 'genesis-alpha-2026',
    ageYears: 4500,
    currentTick: 50,
    resolution: 32,
    metadata: { version: 1, generator: 'seed' },
  });

  // Biomes
  const biomeIds: string[] = [];
  for (const b of BIOME_DEFS) {
    const id = nanoid();
    biomeIds.push(id);
    await db.insert(s.biomes).values({ id, planetId, ...b });
  }

  // Regions (8x8 grid)
  const regionIds: string[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const id = nanoid();
      regionIds.push(id);
      const biomeId = biomeIds[Math.floor(rng() * biomeIds.length)]!;
      await db.insert(s.planetRegions).values({
        id,
        planetId,
        name: `منطقة-${x}-${y}`,
        x,
        y,
        elevation: rng() * 4000 - 500,
        moisture: rng(),
        temperature: -20 + rng() * 55,
        biomeId,
      });
    }
  }

  // Climate cells sample
  for (let i = 0; i < 64; i++) {
    await db.insert(s.climateCells).values({
      id: nanoid(),
      planetId,
      regionId: regionIds[i]!,
      x: i % 8,
      y: Math.floor(i / 8),
      temperature: -10 + rng() * 45,
      humidity: rng(),
      windSpeed: rng() * 30,
      pressure: 980 + rng() * 60,
      tick: 0,
    });
  }

  // ~800 plants (procedural)
  const plantIds: string[] = [];
  const plantPrefixes = ['وريق', 'شوكي', 'زهري', 'طحلب', 'سرخس', 'بلوط', 'صنوبر', 'نخلة', 'طحلب', 'عشب'];
  const plantSuffixes = ['السهول', 'الجبال', 'الوديان', 'الساحل', 'الغابة', 'المستنقع', 'الرياح', 'الظل'];
  for (let i = 0; i < 800; i++) {
    const id = nanoid();
    plantIds.push(id);
    await db.insert(s.plants).values({
      id,
      planetId,
      name: `${pick(plantPrefixes)} ${pick(plantSuffixes)} ${i + 1}`,
      scientificName: `Plantae genus${i}`,
      growthRate: 0.2 + rng() * 2,
      coverage: rng() * 0.8,
      biomeId: pick(biomeIds),
      regionId: pick(regionIds),
      status: rng() > 0.95 ? 'rare' : 'abundant',
      traits: { hardiness: rng(), edible: rng() > 0.6 },
    });
  }

  // ~300 species
  const speciesIds: string[] = [];
  const animalNames = ['ثعلب', 'ذئب', 'نسر', 'غزال', 'سمكة', 'حشرة', 'طائر', 'زواحف', 'قرد', 'دب'];
  for (let i = 0; i < 300; i++) {
    const id = nanoid();
    speciesIds.push(id);
    await db.insert(s.species).values({
      id,
      planetId,
      name: `${pick(animalNames)}-${i + 1}`,
      scientificName: `Animalia sp${i}`,
      kingdom: rng() > 0.15 ? 'animalia' : 'fungi',
      trophicLevel: 1 + Math.floor(rng() * 4),
      population: Math.floor(100 + rng() * 50000),
      status: rng() > 0.98 ? 'endangered' : 'thriving',
      dependsOnPlantId: pick(plantIds),
      regionId: pick(regionIds),
      traits: { speed: rng(), intelligence: rng() },
    });
  }

  // ~120 resources
  const resourceIds: string[] = [];
  for (let i = 0; i < 120; i++) {
    const id = nanoid();
    resourceIds.push(id);
    const type = pick(RESOURCE_TYPES);
    await db.insert(s.resources).values({
      id,
      planetId,
      name: `${type}-${i + 1}`,
      type,
      abundance: rng(),
      renewability: type === 'mineral' || type === 'rare' ? 0 : rng(),
      regionId: pick(regionIds),
    });
  }

  // Languages & cultures + 12 civilizations + 40 cities
  const civIds: string[] = [];
  const cityIds: string[] = [];
  for (let i = 0; i < 12; i++) {
    const langId = nanoid();
    const cultureId = nanoid();
    const civId = nanoid();
    civIds.push(civId);

    await db.insert(s.languages).values({
      id: langId,
      planetId,
      name: `لغة-${CIV_NAMES[i]}`,
      family: pick(['سامية', 'هندوأوروبية', 'معزولة', 'طورانية']),
      script: pick(['أبجدية', 'مقطعية', 'صورية']),
      speakers: Math.floor(5000 + rng() * 200000),
    });

    await db.insert(s.cultures).values({
      id: cultureId,
      planetId,
      civilizationId: civId,
      name: `ثقافة ${CIV_NAMES[i]}`,
      culturalValues: [pick(['الشرف', 'المعرفة', 'القوة', 'التجارة', 'الطبيعة'])],
      arts: [pick(['موسيقى', 'شعر', 'نحت', 'رقص'])],
      religion: pick(['توحيدية', 'طبيعية', 'أسلاف', 'نجوم']),
    });

    await db.insert(s.civilizations).values({
      id: civId,
      planetId,
      name: CIV_NAMES[i]!,
      era: pick(['stone', 'bronze', 'iron', 'medieval', 'industrial']),
      population: Math.floor(20000 + rng() * 500000),
      techLevel: rng(),
      cultureId,
      languageId: langId,
      status: 'rising',
    });

    const cityCount = i < 4 ? 5 : 3; // 4*5 + 8*3 = 20+24 = 44, trim to ~40
    const n = Math.min(cityCount, i < 8 ? cityCount : 2);
    for (let c = 0; c < n; c++) {
      const cityId = nanoid();
      cityIds.push(cityId);
      const isCapital = c === 0;
      await db.insert(s.cities).values({
        id: cityId,
        planetId,
        civilizationId: civId,
        name: `${CIV_NAMES[i]}-${c === 0 ? 'العاصمة' : `مدينة-${c}`}`,
        regionId: pick(regionIds),
        population: Math.floor(1000 + rng() * 80000),
        prosperity: rng(),
        x: Math.floor(rng() * 32),
        y: Math.floor(rng() * 32),
        isCapital,
      });
      if (isCapital) {
        await db.update(s.civilizations).set({ capitalCityId: cityId }).where(eq(s.civilizations.id, civId));
      }
    }
  }

  // Ensure exactly ~40 cities - we may have fewer; pad if needed
  while (cityIds.length < 40) {
    const civId = pick(civIds);
    const cityId = nanoid();
    cityIds.push(cityId);
    await db.insert(s.cities).values({
      id: cityId,
      planetId,
      civilizationId: civId,
      name: `مستوطنة-${cityIds.length}`,
      regionId: pick(regionIds),
      population: Math.floor(500 + rng() * 10000),
      prosperity: rng(),
      x: Math.floor(rng() * 32),
      y: Math.floor(rng() * 32),
      isCapital: false,
    });
  }

  // 50 technologies
  for (let i = 0; i < 50; i++) {
    await db.insert(s.technologies).values({
      id: nanoid(),
      planetId,
      civilizationId: pick(civIds),
      name: TECH_NAMES[i]!,
      category: pick(['agriculture', 'military', 'science', 'culture', 'industry']),
      level: 1 + Math.floor(rng() * 5),
      discoveredAtTick: Math.floor(rng() * 40),
      effects: { prosperity: rng() * 0.2 },
    });
  }

  // Alliances, wars, trade
  await db.insert(s.alliances).values({
    id: nanoid(),
    planetId,
    name: 'حلف الشمال',
    civAId: civIds[0]!,
    civBId: civIds[1]!,
    strength: 0.7,
    formedAtTick: 10,
  });

  await db.insert(s.wars).values({
    id: nanoid(),
    planetId,
    name: 'حرب الموارد الكبرى',
    aggressorId: civIds[2]!,
    defenderId: civIds[3]!,
    cause: 'resource_conflict',
    startedAtTick: 25,
    status: 'ongoing',
    casualties: 12000,
  });

  if (cityIds.length >= 2) {
    await db.insert(s.tradeRoutes).values({
      id: nanoid(),
      planetId,
      fromCityId: cityIds[0]!,
      toCityId: cityIds[1]!,
      resourceId: resourceIds[0],
      volume: 50,
    });
  }

  // Chained world events + causal links + sim ticks + timeline snapshots
  const eventIds: string[] = [];
  const eventChain = [
    { tick: 1, type: 'genesis', title: 'ولادة الكوكب', severity: 'major', description: 'تشكّل ألفا التكوين من سحابة كونية' },
    { tick: 5, type: 'life_emergence', title: 'ظهور الحياة', severity: 'major', description: 'أول كائنات حية في المحيطات' },
    { tick: 10, type: 'plant_spread', title: 'انتشار النباتات', severity: 'minor', description: 'غطاء نباتي يغزو اليابسة' },
    { tick: 15, type: 'species_radiation', title: 'إشعاع الأنواع', severity: 'minor', description: 'تنوع حيواني واسع' },
    { tick: 20, type: 'civ_founding', title: 'تأسيس الحضارات', severity: 'major', description: 'أول مدن ومستوطنات' },
    { tick: 25, type: 'war_start', title: 'اندلاع حرب الموارد', severity: 'critical', description: 'صراع على المعادن النادرة' },
    { tick: 30, type: 'invention', title: 'اختراع البرونز', severity: 'minor', description: 'قفزة تقنية في عدة حضارات' },
    { tick: 35, type: 'disease_spread', title: 'انتشار مرض', severity: 'major', description: 'وباء يصيب المدن الساحلية' },
    { tick: 40, type: 'alliance_formed', title: 'تحالف الشمال', severity: 'info', description: 'تحالف دفاعي بين حضارتين' },
    { tick: 45, type: 'migration', title: 'هجرة كبرى', severity: 'minor', description: 'سكان يغادرون مناطق الجفاف' },
    { tick: 50, type: 'long_term_effect', title: 'أثر طويل الأمد', severity: 'info', description: 'إعادة توازن بيئي بعد الحرب' },
  ];

  for (const ev of eventChain) {
    const id = nanoid();
    eventIds.push(id);
    await db.insert(s.worldEvents).values({
      id,
      planetId,
      tick: ev.tick,
      type: ev.type,
      title: ev.title,
      description: ev.description,
      severity: ev.severity,
      actors: [],
      payload: { seed: 'genesis-alpha-2026' },
    });
    await db.insert(s.simulationTicks).values({
      id: nanoid(),
      planetId,
      tick: ev.tick,
      year: ev.tick * 90,
      deltaSummary: { eventType: ev.type },
    });
  }

  for (let i = 1; i < eventIds.length; i++) {
    await db.insert(s.causalLinks).values({
      id: nanoid(),
      planetId,
      causeEventId: eventIds[i - 1]!,
      effectEventId: eventIds[i]!,
      relation: 'caused',
      strength: 0.6 + rng() * 0.4,
      explanation: `حدث ${eventChain[i - 1]!.title} مهّد لـ ${eventChain[i]!.title}`,
    });
  }

  // Timeline snapshots every 10 ticks
  for (const tick of [0, 10, 20, 30, 40, 50]) {
    await db.insert(s.timelineSnapshots).values({
      id: nanoid(),
      planetId,
      tick,
      year: tick * 90,
      label: `عصر ${tick}`,
      summary: `لقطة زمنية عند التيك ${tick}`,
      state: {
        civilizations: civIds.length,
        cities: cityIds.length,
        species: speciesIds.length,
        plants: plantIds.length,
        tick,
      },
    });
  }

  console.log('Seed complete:');
  console.log(`  planet: ${planetId} (genesis-alpha-2026)`);
  console.log(`  civs=${civIds.length} cities=${cityIds.length} resources=${resourceIds.length}`);
  console.log(`  species=${speciesIds.length} plants=${plantIds.length} techs=50 events=${eventIds.length}`);
  console.log(`  Super Admin: admin@planet.local / Admin@Planet2026!`);
  console.log(`  Demo user:   explorer@planet.local / Explorer@123`);
  console.log(`  DB: ${getSqlitePath(dbPath)}`);

  return { planetId, skipped: false };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.ts')) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

import { hash } from "bcryptjs";
import { Pool } from "pg";
import { SeededRandom, deterministicId } from "@planet/world-generator";
import { config } from "./config.js";
import { migrate } from "./migrate.js";
import { WorldStore } from "./world-store.js";

async function seed(): Promise<void> {
  if (config.NODE_ENV === "production") {
    throw new Error("Sandbox seed data must never run in production");
  }
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  try {
    await migrate(pool);
    const store = new WorldStore(pool, config.WORLD_SEED);
    let state = await store.ensureWorld();
    const random = new SeededRandom(`${state.seed}:database-seed`);
    const land = state.regions.filter((region) => region.biome !== "ocean");

    const plants = Array.from({ length: 800 }, (_, index) => {
      const region = random.pick(land);
      return {
        id: deterministicId(`${state.seed}:plant:${index}`),
        regionId: region.id,
        name: `Flora ${String(index + 1).padStart(3, "0")}`,
        traits: {
          growthRate: Number(random.between(0.04, 0.65).toFixed(4)),
          waterNeed: Number(random.between(0.08, 0.9).toFixed(4)),
          coldResistance: Number(random.between(0.05, 0.95).toFixed(4)),
        },
        population: random.integer(1_000, 4_000_000),
      };
    });
    await pool.query(
      `INSERT INTO plants(id,planet_id,region_id,name,traits,population)
       SELECT x.id::uuid,$2::uuid,x.region_id::uuid,x.name,x.traits,x.population
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text,region_id text,name text,traits jsonb,population bigint
       ) ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(plants), state.planetId],
    );

    const resourceKinds = [
      "iron",
      "copper",
      "silicon",
      "fresh_water",
      "geothermal",
      "biomass",
    ];
    const resources = Array.from({ length: 120 }, (_, index) => {
      const region = random.pick(land);
      return {
        id: deterministicId(`${state.seed}:resource:${index}`),
        regionId: region.id,
        kind: resourceKinds[index % resourceKinds.length],
        quantity: random.integer(10_000, 9_000_000),
        regeneration: Number(random.between(0, 0.08).toFixed(4)),
        value: Number(random.between(0.1, 1).toFixed(4)),
      };
    });
    await pool.query(
      `INSERT INTO resources(
         id,planet_id,region_id,kind,quantity,regeneration_rate,value,metadata
       )
       SELECT x.id::uuid,$2::uuid,x.region_id::uuid,x.kind,x.quantity,x.regeneration,
              x.value,jsonb_build_object('seeded',true)
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text,region_id text,kind text,quantity numeric,regeneration numeric,value numeric
       ) ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(resources), state.planetId],
    );

    const cities = Array.from({ length: 40 }, (_, index) => {
      const civilization =
        state.civilizations[index % state.civilizations.length]!;
      const capitalRegion = state.regions.find(
        (region) => region.id === civilization.regionId,
      )!;
      const nearby = land
        .filter(
          (region) =>
            Math.abs(region.latitude - capitalRegion.latitude) < 30 &&
            Math.abs(region.longitude - capitalRegion.longitude) < 45,
        )
        .sort((left, right) => right.fertility - left.fertility);
      const region =
        nearby[index % Math.max(1, nearby.length)] ?? capitalRegion;
      return {
        id: deterministicId(`${state.seed}:city:${index}`),
        civilizationId: civilization.id,
        regionId: region.id,
        name: `${civilization.name} ${index + 1}`,
        population: random.integer(4_000, 90_000),
        isCapital: index < state.civilizations.length,
      };
    });
    await pool.query(
      `INSERT INTO cities(id,civilization_id,region_id,name,population,is_capital)
       SELECT x.id::uuid,x.civilization_id::uuid,x.region_id::uuid,x.name,x.population,x.is_capital
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text,civilization_id text,region_id text,name text,population bigint,is_capital boolean
       ) ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(cities)],
    );

    const technologies = Array.from({ length: 50 }, (_, index) => ({
      id: deterministicId(`${state.seed}:technology:${index}`),
      civilizationId:
        state.civilizations[index % state.civilizations.length]!.id,
      name: `Technology ${String(index + 1).padStart(2, "0")}`,
      level: Number((0.08 + index * 0.012).toFixed(3)),
      year: Math.floor(index / 4),
    }));
    await pool.query(
      `INSERT INTO technologies(
         id,planet_id,civilization_id,name,level,discovered_year,effects
       )
       SELECT x.id::uuid,$2::uuid,x.civilization_id::uuid,x.name,x.level,x.year,
              jsonb_build_object('productivity',x.level * 0.3)
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text,civilization_id text,name text,level real,year bigint
       ) ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(technologies), state.planetId],
    );

    const adminEmail = "admin@planet.local";
    const adminPassword =
      process.env.SANDBOX_ADMIN_PASSWORD ?? "PlanetSandbox!2026";
    const passwordHash = await hash(adminPassword, 12);
    const admin = await pool.query<{ id: string }>(
      `INSERT INTO users(email,password_hash)
       VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET updated_at=now()
       RETURNING id`,
      [adminEmail, passwordHash],
    );
    await pool.query(
      `INSERT INTO profiles(user_id,display_name,locale)
       VALUES ($1,'Sandbox Super Admin','ar') ON CONFLICT (user_id) DO NOTHING`,
      [admin.rows[0]!.id],
    );
    await pool.query(
      `INSERT INTO user_roles(user_id,role_id)
       SELECT $1,id FROM roles WHERE name='super_admin'
       ON CONFLICT DO NOTHING`,
      [admin.rows[0]!.id],
    );

    if (state.tick === 0) {
      state = (await store.runTicks(12)).state;
    }
    console.info(
      JSON.stringify({
        level: "info",
        message: "sandbox world seeded",
        planetId: state.planetId,
        tick: state.tick,
        counts: {
          civilizations: 12,
          cities: 40,
          resources: 120,
          species: 300,
          plants: 800,
          technologies: 50,
        },
      }),
    );
  } finally {
    await pool.end();
  }
}

await seed();

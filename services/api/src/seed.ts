import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { biomeTypes } from "@living-planet/shared-types";
import {
  deterministicId,
  generateWorld,
  simulateTick,
  stateChecksum,
} from "@living-planet/simulation-models";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 4 });
const scrypt = promisify(scryptCallback);
const seed = process.env.WORLD_SEED ?? "azura-prime-7";

async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

let state = generateWorld(seed);
const events = [];
const causalLinks = [];
for (let index = 0; index < 5; index += 1) {
  const result = simulateTick(state, events);
  state = result.state;
  events.push(...result.events);
  causalLinks.push(...result.causalLinks);
}

const adminId = "00000000-0000-4000-8000-000000000007";
const adminPassword = await passwordHash("Azura!2347");

await sql.begin(async (transaction) => {
  for (const role of [
    "user",
    "explorer",
    "life_maker",
    "civilization_builder",
    "historian",
    "moderator",
    "simulation_admin",
    "admin",
    "super_admin",
  ]) {
    await transaction`
      insert into roles (name, permissions)
      values (${role}, ${transaction.json(role === "super_admin" ? ["*"] : ["world:read"])})
      on conflict (name) do nothing
    `;
  }
  await transaction`
    insert into users (id, email, display_name, password_hash, role, status)
    values (${adminId}, 'explorer@azura.world', 'مستكشف أزورا', ${adminPassword}, 'super_admin', 'active')
    on conflict (email) do nothing
  `;
  await transaction`
    insert into profiles (user_id, bio, impact_level)
    values (${adminId}, 'حساب Sandbox لإدارة العالم المحلي فقط.', 7)
    on conflict (user_id) do nothing
  `;

  await transaction`
    insert into planets (id, name_ar, name_en, seed, version, state)
    values (${state.planetId}, 'أزورا', 'Azura', ${seed}, ${state.version}, ${transaction.json(state)})
    on conflict (id) do update
      set version = excluded.version, state = excluded.state, updated_at = now()
  `;

  const biomeIds = new Map<string, string>();
  for (const [index, biome] of biomeTypes.entries()) {
    const id = deterministicId(seed, "biome", index);
    biomeIds.set(biome, id);
    await transaction`
      insert into biomes (id, code, name_ar, name_en, rules)
      values (${id}, ${biome}, ${biome}, ${biome.replaceAll("_", " ")}, ${transaction.json({ generated: true })})
      on conflict (code) do update set rules = excluded.rules
    `;
  }

  for (const region of state.regions) {
    await transaction`
      insert into planet_regions
        (id, planet_id, biome_id, region_index, name_ar, name_en, center, elevation,
         temperature, moisture, fertility, population, carrying_capacity, state)
      values
        (${region.id}, ${state.planetId}, ${biomeIds.get(region.biome)!}, ${region.index},
         ${region.nameAr}, ${region.nameEn},
         ST_SetSRID(ST_MakePoint(${region.longitude}, ${region.latitude}), 4326)::geography,
         ${region.elevation}, ${region.temperature}, ${region.moisture}, ${region.fertility},
         ${region.population}, ${region.carryingCapacity}, ${transaction.json(region)})
      on conflict (id) do update set
        temperature = excluded.temperature,
        moisture = excluded.moisture,
        population = excluded.population,
        state = excluded.state
    `;
  }

  for (const civilization of state.civilizations) {
    await transaction`
      insert into civilizations
        (id, planet_id, name_ar, name_en, population, technology, economy, military,
         stability, health, education, pollution, state, founded_tick)
      values
        (${civilization.id}, ${state.planetId}, ${civilization.nameAr}, ${civilization.nameEn},
         ${civilization.population}, ${civilization.technology}, ${civilization.economy},
         ${civilization.military}, ${civilization.stability}, ${civilization.health},
         ${civilization.education}, ${civilization.pollution}, ${transaction.json(civilization)}, 0)
      on conflict (id) do update set population = excluded.population, state = excluded.state
    `;
  }

  for (let index = 0; index < 40; index += 1) {
    const civilization = state.civilizations[index % state.civilizations.length]!;
    const region = state.regions.find((candidate) =>
      civilization.regionIds.includes(candidate.id),
    )!;
    const cityId = deterministicId(seed, "city", index);
    await transaction`
      insert into cities
        (id, civilization_id, region_id, name_ar, name_en, location, population,
         economy, defenses, founded_tick, state)
      values
        (${cityId}, ${civilization.id}, ${region.id}, ${`مدينة أزورا ${index + 1}`},
         ${`Azura City ${index + 1}`},
         ST_SetSRID(ST_MakePoint(${region.longitude}, ${region.latitude}), 4326)::geography,
         ${Math.max(12_000, Math.round(civilization.population / 8))}, ${civilization.economy},
         ${civilization.military}, 0, ${transaction.json({ generated: true })})
      on conflict (id) do nothing
    `;
  }

  for (let index = 0; index < 120; index += 1) {
    const region = state.regions[(index * 17) % state.regions.length]!;
    await transaction`
      insert into resources
        (id, planet_id, region_id, name_ar, name_en, quantity, regeneration_rate,
         value, uses, environmental_impact, state)
      values
        (${deterministicId(seed, "resource", index)}, ${state.planetId}, ${region.id},
         ${`مورد أزوري ${index + 1}`}, ${`Azuran Resource ${index + 1}`},
         ${Math.round(10_000 + region.resourceRichness * 900_000)},
         ${index % 4 === 0 ? 0.018 : 0}, ${0.2 + region.resourceRichness * 0.8},
         ${transaction.json(["industry", "energy"])}, ${0.08 + (index % 7) * 0.04},
         ${transaction.json({ generated: true })})
      on conflict (id) do nothing
    `;
  }

  for (const species of state.species) {
    await transaction`
      insert into species
        (id, planet_id, kind, name_ar, name_en, population, carrying_capacity,
         traits, status, created_tick)
      values
        (${species.id}, ${state.planetId}, ${species.kind}, ${species.nameAr}, ${species.nameEn},
         ${species.population}, ${species.carryingCapacity}, ${transaction.json(species.traits)},
         'active', 0)
      on conflict (id) do nothing
    `;
    if (species.kind === "plant") {
      await transaction`
        insert into plants
          (species_id, growth_rate, water_need, pollution_absorption, energy_yield, biome_codes)
        values
          (${species.id}, ${species.traits.growthRate}, ${species.traits.waterNeed},
           ${species.traits.pollutionAbsorption}, ${species.traits.energyYield}, ${["plains"]})
        on conflict (species_id) do nothing
      `;
    }
  }

  for (let index = 0; index < 50; index += 1) {
    const civilization = state.civilizations[index % state.civilizations.length]!;
    await transaction`
      insert into technologies
        (id, planet_id, discovered_by, name_ar, name_en, level, effects, discovered_tick)
      values
        (${deterministicId(seed, "technology", index)}, ${state.planetId}, ${civilization.id},
         ${`تقنية أزورية ${index + 1}`}, ${`Azuran Technology ${index + 1}`},
         ${0.15 + (index % 10) * 0.08}, ${transaction.json({ economy: 0.01, emissions: -0.002 })},
         ${Math.max(0, state.tick - (index % 5))})
      on conflict (id) do nothing
    `;
  }

  for (const event of events) {
    await transaction`
      insert into world_events
        (id, planet_id, sequence, event_type, simulation_year, tick, region_id, contribution_id, payload)
      values
        (${event.id}, ${state.planetId}, ${event.sequence}, ${event.type}, ${event.simulationYear},
         ${event.tick}, ${event.regionId ?? null}, ${event.contributionId ?? null}, ${transaction.json(event)})
      on conflict (id) do nothing
    `;
  }
  for (const link of causalLinks) {
    await transaction`
      insert into causal_links (id, planet_id, from_event_id, to_event_id, relation, strength, payload)
      values (${link.id}, ${state.planetId}, ${link.fromEventId}, ${link.toEventId},
              ${link.relation}, ${link.strength}, ${transaction.json(link)})
      on conflict (id) do nothing
    `;
  }
  await transaction`
    insert into timeline_snapshots
      (id, planet_id, tick, simulation_year, event_sequence, checksum, payload)
    values
      (${deterministicId(seed, "snapshot", state.tick)}, ${state.planetId}, ${state.tick},
       ${state.year}, ${state.lastEventSequence}, ${stateChecksum(state)},
       ${transaction.json({
         id: deterministicId(seed, "snapshot", state.tick),
         planetId: state.planetId,
         tick: state.tick,
         year: state.year,
         eventSequence: state.lastEventSequence,
         state,
         checksum: stateChecksum(state),
         createdAt: new Date().toISOString(),
       })})
    on conflict (planet_id, tick) do update set payload = excluded.payload
  `;
});

console.info(
  JSON.stringify({
    status: "ok",
    planetId: state.planetId,
    counts: {
      civilizations: state.civilizations.length,
      cities: 40,
      resources: 120,
      creatures: 300,
      plants: 800,
      technologies: 50,
      events: events.length,
    },
  }),
);
await sql.end();

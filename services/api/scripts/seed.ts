import "../src/env.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { AppModule } from "../src/app.module.js";
import { DatabaseService } from "../src/database.service.js";

const scrypt = promisify(scryptCallback);
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ["error", "warn", "log"],
});

try {
  const database = app.get(DatabaseService);
  const email = "superadmin@planet.sandbox";
  const password = "PlanetSandbox!2026";
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const passwordHash = `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
  await database.query(
    `WITH admin AS (
       INSERT INTO users(email,password_hash,role,preferred_locale)
       VALUES($1,$2,'super_admin','ar')
       ON CONFLICT(email) DO UPDATE SET role='super_admin'
       RETURNING id
     )
     INSERT INTO profiles(user_id,display_name)
     SELECT id,'مدير العالم التجريبي' FROM admin
     ON CONFLICT(user_id) DO NOTHING`,
    [email, passwordHash],
  );
  await database.query(
    `WITH ranked_civs AS (
       SELECT id,region_id,row_number() OVER (ORDER BY id) AS rn FROM civilizations
     ), ranked_regions AS (
       SELECT id,center,row_number() OVER (ORDER BY id) AS rn
       FROM planet_regions WHERE biome_code <> 'ocean'
     ), generated AS (
       SELECT g,c.id AS civilization_id,r.id AS region_id,r.center
       FROM generate_series(1,40) g
       JOIN ranked_civs c ON c.rn=((g-1)%12)+1
       JOIN ranked_regions r ON r.rn=((g-1)%(SELECT count(*) FROM ranked_regions))+1
     )
     INSERT INTO cities(civilization_id,region_id,name,location,population,economy,health,founded_tick)
     SELECT civilization_id,region_id,'Sandbox City ' || g,center,
            25000 + g*1750,0.25 + (g%8)*0.06,0.55 + (g%5)*0.05,0
     FROM generated
     WHERE NOT EXISTS (SELECT 1 FROM cities)`,
  );
  await database.query(
    `WITH planet AS (SELECT id FROM planets ORDER BY created_at LIMIT 1),
     ranked_regions AS (
       SELECT id,row_number() OVER (ORDER BY id) AS rn
       FROM planet_regions WHERE biome_code <> 'ocean'
     )
     INSERT INTO resources(
       planet_id,region_id,name,quantity,regeneration_rate,extraction_rate,value,
       uses,substitutes,environmental_impact
     )
     SELECT planet.id,region.id,'Resource ' || g,10000 + g*275,0.005*(g%7),
            0,0.2+(g%9)*0.07,'["energy","industry"]','[]',0.04+(g%6)*0.03
     FROM generate_series(1,120) g
     CROSS JOIN planet
     JOIN ranked_regions region ON region.rn=((g-1)%(SELECT count(*) FROM ranked_regions))+1
     WHERE NOT EXISTS (SELECT 1 FROM resources existing WHERE existing.planet_id=planet.id)`,
  );
  await database.query(
    `WITH planet AS (SELECT id FROM planets ORDER BY created_at LIMIT 1)
     INSERT INTO species(planet_id,name,traits,population,habitat_region_ids,status,created_tick)
     SELECT planet.id,'Species ' || g,
            jsonb_build_object(
              'size',(g%10)/10.0,'reproductionRate',0.1+(g%8)/10.0,
              'adaptability',0.2+(g%7)/10.0,'aggression',(g%6)/10.0
            ),
            1000+g*91,'[]','active',0
     FROM generate_series(1,300) g CROSS JOIN planet
     WHERE NOT EXISTS (SELECT 1 FROM species existing WHERE existing.planet_id=planet.id)`,
  );
  await database.query(
    `WITH planet AS (SELECT id FROM planets ORDER BY created_at LIMIT 1)
     INSERT INTO plants(planet_id,name,traits,biomass,habitat_region_ids,status,created_tick)
     SELECT planet.id,'Plant ' || g,
            jsonb_build_object(
              'growthRate',0.1+(g%9)/10.0,'waterNeed',0.1+(g%8)/10.0,
              'coldResistance',(g%7)/10.0,'heatResistance',(g%6)/10.0
            ),
            5000+g*37,'[]','active',0
     FROM generate_series(1,800) g CROSS JOIN planet
     WHERE NOT EXISTS (SELECT 1 FROM plants existing WHERE existing.planet_id=planet.id)`,
  );
  await database.query(
    `WITH planet AS (SELECT id FROM planets ORDER BY created_at LIMIT 1),
     ranked_civs AS (SELECT id,row_number() OVER (ORDER BY id) AS rn FROM civilizations)
     INSERT INTO technologies(
       planet_id,civilization_id,name,level,prerequisites,effects,discovered_tick
     )
     SELECT planet.id,civ.id,'Technology ' || g,0.1+(g%9)/10.0,
            '[]',jsonb_build_object('innovation',0.01*(g%7)),0
     FROM generate_series(1,50) g
     CROSS JOIN planet
     JOIN ranked_civs civ ON civ.rn=((g-1)%12)+1
     WHERE NOT EXISTS (SELECT 1 FROM technologies existing WHERE existing.planet_id=planet.id)`,
  );
  process.stdout.write(
    "Sandbox world and account seeded. Credentials are documented in README only.\n",
  );
} finally {
  await app.close();
}

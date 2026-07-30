INSERT INTO roles (name, permissions) VALUES
  ('visitor', '["world:read"]'),
  ('user', '["world:read", "contribution:create"]'),
  ('explorer', '["world:read", "timeline:compare"]'),
  ('life_maker', '["world:read", "contribution:create"]'),
  ('civilization_creator', '["world:read", "contribution:create"]'),
  ('historian', '["world:read", "timeline:compare", "causes:read"]'),
  ('moderator', '["moderation:read", "moderation:write"]'),
  ('simulation_manager', '["simulation:read", "simulation:control", "snapshot:rollback"]'),
  ('admin', '["users:read", "moderation:write", "simulation:read", "audit:read"]'),
  ('super_admin', '["*"]')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (id, email, password_hash, display_name)
VALUES (
  '00000000-0000-4000-8000-000000000010',
  'admin@planet.local',
  crypt('Planet-Sandbox-2026!', gen_salt('bf', 12)),
  'Sandbox Super Admin'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (user_id, locale)
VALUES ('00000000-0000-4000-8000-000000000010', 'ar')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '00000000-0000-4000-8000-000000000010', id FROM roles WHERE name = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO biomes (code, name_ar, name_en, rules) VALUES
  ('ocean', 'محيط', 'Ocean', '{"water": 1, "habitability": 0.08}'),
  ('coast', 'ساحل', 'Coast', '{"water": 0.8, "habitability": 0.85}'),
  ('plains', 'سهول', 'Plains', '{"fertility": 0.7, "habitability": 1}'),
  ('tropical_forest', 'غابة مطيرة', 'Tropical forest', '{"moisture": 0.85, "habitability": 0.8}'),
  ('temperate_forest', 'غابة معتدلة', 'Temperate forest', '{"moisture": 0.65, "habitability": 0.9}'),
  ('desert', 'صحراء', 'Desert', '{"moisture": 0.1, "habitability": 0.25}'),
  ('mountain', 'جبال', 'Mountain', '{"elevation": 0.85, "habitability": 0.3}'),
  ('tundra', 'تندرا', 'Tundra', '{"temperature": 0.15, "habitability": 0.25}'),
  ('wetland', 'مستنقعات', 'Wetland', '{"moisture": 0.9, "habitability": 0.55}'),
  ('steppe', 'سهوب', 'Steppe', '{"moisture": 0.3, "habitability": 0.7}'),
  ('volcanic', 'بركانية', 'Volcanic', '{"plateActivity": 0.9, "habitability": 0.15}'),
  ('ice', 'أراض جليدية', 'Ice', '{"temperature": 0.03, "habitability": 0.03}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO planets (id, name, seed, current_tick, current_year, settings)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'أوريانا',
  'oriana-genesis-7',
  128,
  128,
  '{"rows": 12, "columns": 24, "quality": "adaptive"}'
)
ON CONFLICT (seed) DO NOTHING;

WITH generated AS (
  SELECT
    i,
    -90.0 + ((floor(i / 24) + 0.5) / 12.0) * 180.0 AS latitude,
    -180.0 + (((i % 24) + 0.5) / 24.0) * 360.0 AS longitude,
    least(1.0, abs(sin((i + 7) * 12.9898) * 0.52 + cos((i + 19) * 4.1414) * 0.21)) AS elevation,
    abs(sin((i + 31) * 7.2123)) AS moisture,
    greatest(0.02, 1.0 - abs((-90.0 + ((floor(i / 24) + 0.5) / 12.0) * 180.0) / 90.0)) AS temperature,
    abs(sin((i + 47) * 3.7719)) AS plate_activity
  FROM generate_series(0, 287) AS i
), classified AS (
  SELECT *,
    greatest(0.02, least(1.0, moisture * 0.58 + temperature * 0.3 + plate_activity * 0.12)) AS fertility,
    CASE
      WHEN elevation < 0.40 THEN 'ocean'
      WHEN elevation < 0.45 THEN 'coast'
      WHEN temperature < 0.10 THEN 'ice'
      WHEN elevation > 0.82 AND plate_activity > 0.70 THEN 'volcanic'
      WHEN elevation > 0.78 THEN 'mountain'
      WHEN temperature < 0.25 THEN 'tundra'
      WHEN moisture < 0.20 AND temperature > 0.50 THEN 'desert'
      WHEN moisture < 0.35 THEN 'steppe'
      WHEN moisture > 0.78 AND elevation < 0.60 THEN 'wetland'
      WHEN moisture > 0.68 AND temperature > 0.62 THEN 'tropical_forest'
      WHEN moisture > 0.52 THEN 'temperate_forest'
      ELSE 'plains'
    END AS biome
  FROM generated
)
INSERT INTO planet_regions (
  id, planet_id, region_index, name, center, latitude, longitude, biome_code,
  elevation, temperature, moisture, fertility, surface_water, plate_activity,
  resource_richness, carrying_capacity, population, pollution, biodiversity, economy
)
SELECT
  'region-' || lpad(i::text, 4, '0'),
  '00000000-0000-4000-8000-000000000001',
  i,
  'Sector ' || chr(65 + (floor(i / 24)::integer % 26)) || '-' || ((i % 24) + 1),
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
  latitude,
  longitude,
  biome,
  elevation,
  temperature,
  moisture,
  fertility,
  CASE WHEN biome = 'ocean' THEN 1 ELSE moisture * (1 - elevation) END,
  plate_activity,
  least(1, plate_activity * 0.55 + (1 - fertility) * 0.45),
  round((fertility * 700000 + moisture * 300000) * CASE WHEN biome IN ('ocean', 'ice') THEN 0.08 ELSE 1 END),
  round((fertility * 700000 + moisture * 300000) * CASE WHEN biome IN ('ocean', 'ice') THEN 0.005 ELSE 0.12 END),
  0.015,
  greatest(0.05, fertility * 0.85 + moisture * 0.15),
  round(fertility * 850000)
FROM classified
ON CONFLICT (id) DO NOTHING;

INSERT INTO climate_cells (region_id, tick, temperature, moisture, pressure, wind_vector, precipitation, emissions)
SELECT id, 128, temperature, moisture, 1013 - elevation * 180, '{"x": 0.3, "y": 0.1}', moisture * 220, pollution * 10
FROM planet_regions
WHERE planet_id = '00000000-0000-4000-8000-000000000001'
ON CONFLICT (region_id, tick) DO NOTHING;

INSERT INTO cultures (planet_id, name, values, origin_tick)
SELECT '00000000-0000-4000-8000-000000000001', 'Culture ' || i, jsonb_build_object('cooperation', (i % 5) / 5.0, 'innovation', ((i + 2) % 5) / 5.0), i * 3
FROM generate_series(1, 12) AS i;

INSERT INTO languages (planet_id, name, family, features, origin_tick)
SELECT '00000000-0000-4000-8000-000000000001', 'Language ' || i, 'Family ' || ((i - 1) % 4 + 1), jsonb_build_object('complexity', (i % 7) / 7.0), i * 3
FROM generate_series(1, 12) AS i;

WITH ranked_cultures AS (
  SELECT id, row_number() OVER (ORDER BY name) AS rn FROM cultures
  WHERE planet_id = '00000000-0000-4000-8000-000000000001'
), ranked_languages AS (
  SELECT id, row_number() OVER (ORDER BY name) AS rn FROM languages
  WHERE planet_id = '00000000-0000-4000-8000-000000000001'
)
INSERT INTO civilizations (
  planet_id, name, capital_region_id, culture_id, language_id, population, government,
  technology_level, military_power, economy, health, stability, education, pollution,
  happiness, innovation, strategic_memory, founded_tick
)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'Civilization ' || c.rn,
  'region-' || lpad(((c.rn * 19) % 288)::text, 4, '0'),
  c.id,
  l.id,
  120000 + c.rn * 18000,
  CASE WHEN c.rn % 3 = 0 THEN 'council' WHEN c.rn % 3 = 1 THEN 'republic' ELSE 'monarchy' END,
  0.25 + c.rn * 0.035,
  4000 + c.rn * 670,
  900000 + c.rn * 125000,
  0.72,
  0.64,
  0.55,
  0.08,
  0.68,
  0.44 + c.rn * 0.02,
  '[]',
  c.rn * 4
FROM ranked_cultures c
JOIN ranked_languages l ON l.rn = c.rn;

WITH ranked_civs AS (
  SELECT id, row_number() OVER (ORDER BY name) AS rn
  FROM civilizations WHERE planet_id = '00000000-0000-4000-8000-000000000001'
)
INSERT INTO cities (civilization_id, region_id, name, population, food_stock, infrastructure, founded_tick)
SELECT
  c.id,
  'region-' || lpad(((i * 7) % 288)::text, 4, '0'),
  'City ' || i,
  18000 + i * 1250,
  80000 + i * 3500,
  0.3 + (i % 8) * 0.06,
  20 + i
FROM generate_series(1, 40) AS i
JOIN ranked_civs c ON c.rn = ((i - 1) % 12) + 1;

INSERT INTO resources (
  planet_id, region_id, name, resource_type, quantity, regeneration_rate,
  extraction_rate, value, uses, alternatives, environmental_impact
)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'region-' || lpad(((i * 11) % 288)::text, 4, '0'),
  'Resource ' || i,
  (ARRAY['mineral', 'energy', 'water', 'biological'])[((i - 1) % 4) + 1],
  25000 + i * 975,
  CASE WHEN i % 4 IN (2, 3) THEN 0.02 ELSE 0 END,
  0.01 + (i % 6) * 0.005,
  20 + i * 1.7,
  jsonb_build_array('industry', 'trade'),
  jsonb_build_array('recycling'),
  (i % 10) / 20.0
FROM generate_series(1, 120) AS i;

INSERT INTO species (planet_id, name, home_region_id, traits, population, created_at_tick)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'Species ' || i,
  'region-' || lpad(((i * 13) % 288)::text, 4, '0'),
  jsonb_build_object('size', (i % 10) / 10.0, 'adaptability', ((i + 3) % 10) / 10.0, 'reproductionRate', ((i + 6) % 10) / 10.0),
  500 + i * 37,
  i % 90
FROM generate_series(1, 300) AS i;

INSERT INTO plants (planet_id, name, home_region_id, traits, population, created_at_tick)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'Plant ' || i,
  'region-' || lpad(((i * 17) % 288)::text, 4, '0'),
  jsonb_build_object('growthRate', (i % 10) / 10.0, 'waterNeed', ((i + 2) % 10) / 10.0, 'coldResistance', ((i + 5) % 10) / 10.0),
  2000 + i * 91,
  i % 100
FROM generate_series(1, 800) AS i;

WITH ranked_civs AS (
  SELECT id, row_number() OVER (ORDER BY name) AS rn
  FROM civilizations WHERE planet_id = '00000000-0000-4000-8000-000000000001'
)
INSERT INTO technologies (planet_id, civilization_id, name, category, level, prerequisites, effects, discovered_tick)
SELECT
  '00000000-0000-4000-8000-000000000001',
  c.id,
  'Technology ' || i,
  (ARRAY['energy', 'agriculture', 'medicine', 'transport', 'materials'])[((i - 1) % 5) + 1],
  0.2 + (i % 10) * 0.07,
  '[]',
  jsonb_build_object('productivity', 0.02 + (i % 7) * 0.01),
  25 + i * 2
FROM generate_series(1, 50) AS i
JOIN ranked_civs c ON c.rn = ((i - 1) % 12) + 1;

INSERT INTO world_events (
  id, planet_id, tick, year, type, title, summary, region_id, cause,
  direct_effects, importance, confidence, created_at
)
SELECT
  'evt-seed-' || lpad(i::text, 4, '0'),
  '00000000-0000-4000-8000-000000000001',
  i * 5,
  i * 5,
  (ARRAY['RESOURCE_DISCOVERED', 'SPECIES_CREATED', 'CITY_CREATED', 'TECHNOLOGY_DISCOVERED', 'MIGRATION_STARTED', 'CLIMATE_CHANGED'])[((i - 1) % 6) + 1],
  'Foundational event ' || i,
  'A deterministic event in the seeded history of Oriana.',
  'region-' || lpad(((i * 23) % 288)::text, 4, '0'),
  'Seeded environmental and social thresholds were crossed by recorded world state',
  jsonb_build_object('economy', i * 12, 'biodiversity', ((i % 3) - 1) * 0.002),
  0.35 + (i % 6) * 0.1,
  0.82,
  timestamptz '2000-01-01' + (i * interval '1 day')
FROM generate_series(1, 24) AS i
ON CONFLICT (id) DO NOTHING;

INSERT INTO causal_links (id, planet_id, source_event_id, target_event_id, mechanism, strength)
SELECT
  'cause-seed-' || lpad(i::text, 4, '0'),
  '00000000-0000-4000-8000-000000000001',
  'evt-seed-' || lpad(i::text, 4, '0'),
  'evt-seed-' || lpad((i + 1)::text, 4, '0'),
  'Resource, habitat and population changes propagated into the next recorded event',
  0.62
FROM generate_series(1, 23) AS i
ON CONFLICT (id) DO NOTHING;

# Database

Drizzle schema: `services/api/src/db/schema.ts`  
Migrations: `services/api/drizzle/`

## Entities (implemented)

User, Profile, Role, Planet, PlanetRegion, Biome, ClimateCell, Species, Plant, Resource, Civilization, City, Technology, Culture, Language, TradeRoute, Alliance, War, Disease, Migration, UserContribution, SimulationTick, WorldEvent, CausalLink, TimelineSnapshot, AIRequest, ModerationResult, Notification, AuditLog

## Modes

- **Memory** (default): no `DATABASE_URL` — full demo works locally
- **PostgreSQL**: set `DATABASE_URL`, then `pnpm db:migrate && pnpm db:seed`

PostGIS / pgvector are planned extension points (columns/json ready for embeddings later); not required for sandbox.

## Seed accounts

See root README Sandbox section.

# Database Schema

PostgreSQL tables (see `services/api/src/db/schema.ts` and `migrate.ts`):

User, Profile, Role(via users.role), Planet, PlanetRegion, Species, Plant, Resource,
Civilization, City, Technology, Culture, Language, TradeRoute, Alliance, War, Disease,
Migration, UserContribution, SimulationTick, WorldEvent, CausalLink, TimelineSnapshot,
AIRequest, ModerationResult, Notification, AuditLog, WorldStateBlob.

`world_state_blobs.state` holds the authoritative JSON world for deterministic replay.
Relational tables support queries, admin, and overlays.

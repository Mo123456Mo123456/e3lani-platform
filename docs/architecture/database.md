# Database Schema

Prisma schema: `packages/db/prisma/schema.prisma`

Core entities:

User, Profile, Role (enum), Planet, PlanetRegion, ClimateCell, Species, Plant, Resource, Civilization, City, Technology, Culture, Language, TradeRoute, Alliance, War, Disease, Migration, UserContribution, SimulationTick, WorldEvent, CausalLink, TimelineSnapshot, AIRequest, ModerationResult, Notification, AuditLog

## Seed targets (default planet)

| Entity | Target |
|---|---|
| Civilizations | 12 |
| Cities | ~40 |
| Resources | 120 |
| Species | 300 |
| Plants | 800 |
| Technologies | 50 |
| Timeline milestones | seeded history chain |

Seed script: `packages/db/src/seed.ts` (deterministic from `DEFAULT_PLANET_SEED`).

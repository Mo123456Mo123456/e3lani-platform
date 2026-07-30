# Architecture — كوكب يولد أمامك

## Overview

```
┌────────────┐   ┌────────────┐
│  apps/web  │   │ apps/admin │
│ Next.js+R3F│   │  Next.js   │
└─────┬──────┘   └─────┬──────┘
      │ REST/WS        │ REST
      ▼                ▼
┌─────────────────────────────────┐
│          services/api           │
│ Fastify · Auth · OpenAPI · WS   │
└───────┬─────────────┬───────────┘
        │             │
        ▼             ▼
┌──────────────┐ ┌────────────────────┐
│ simulation-  │ │  ai-orchestrator   │
│ engine       │ │ Provider adapters  │
│ (ticks/ECS)  │ │ sandbox/openai/... │
└──────┬───────┘ └────────────────────┘
       │
       ▼
 packages/simulation-models  (deterministic core)
       │
       ▼
 PostgreSQL (+ Redis cache/queues)
```

## Hard rules

1. **Simulation first**: causal outcomes come from `@planet/simulation-models`, not LLM invention.
2. **AI is layered**: parse → balance → (sim) → narrate from events only.
3. **Determinism**: same seed + same events ⇒ same history (`SeededRandom`, event sourcing, snapshots).
4. **UI has no sim logic**: web renders state; ticks run in API/engine.

## Packages

| Package | Role |
|---|---|
| `shared-types` | DTOs, enums, realtime envelopes |
| `simulation-models` | RNG, noise, biomes, world gen, ticks, contributions, Monte Carlo, pathfinding |
| `validation` | Zod + injection detection |
| `config` | Env + brand tokens |
| `ui` | Shared CSS/tokens |
| `analytics` | Event names |

## Data flow: add element

1. User writes idea → `POST /v1/contributions/analyze`
2. Moderation + AI structured output (or sandbox)
3. Balance caps applied
4. Preview impact from current world state
5. Confirm → snapshot before → `applyContribution` → advance ticks → persist events/links
6. Narrate **only** from produced events
7. Optional Monte Carlo forecast (probabilistic, labeled)

## Realtime

Socket.IO path `/ws` emits delta messages on channels: `world.events`, `world.tick`, `contribution.status`, `notification`, `ai.status`.

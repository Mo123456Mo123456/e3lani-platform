# A Planet Being Born Before You / كوكب يولد أمامك

**Your world, your choice, an endless impact.**  
**عالمك، قرارك، أثر لا ينتهي.**

Living procedural planet platform: deterministic simulation engine + causal graphs + AI narration adapters + WebGL globe (React Three Fiber) + PostgreSQL persistence + realtime deltas.

> Arabic guide: [README.ar.md](./README.ar.md)

## Monorepo layout

```
apps/web                 Next.js + R3F client (RTL/LTR)
apps/admin               Protected admin console (no public nav link)
services/api             Fastify API, auth, WS, OpenAPI
services/simulation-engine  Tick engine HTTP service (+ Python scientific sidecar)
services/ai-orchestrator    Provider adapters (mock/openai/anthropic/gemini)
services/world-generator    Seeded world CLI/library
services/realtime-gateway   Topology placeholder (WS currently on API)
services/notification-worker
packages/*               shared-types, simulation-models, validation, ui, config, analytics
```

## Quick start

### Prerequisites

- Node.js 20+
- pnpm 9.12+
- PostgreSQL 16
- Redis (optional locally)

```bash
cp .env.example .env
# ensure DATABASE_URL points to a running Postgres

pnpm install
pnpm --filter @planet/config --filter @planet/shared-types --filter @planet/validation --filter @planet/simulation-models --filter @planet/analytics --filter @planet/ui build
pnpm db:migrate
pnpm db:seed
```

### Run (three terminals or parallel)

```bash
pnpm --filter @planet/ai-orchestrator dev
pnpm --filter @planet/api dev
pnpm --filter @planet/web dev
```

Optional:

```bash
pnpm --filter @planet/simulation-engine dev
pnpm --filter @planet/admin dev
```

- Web: http://localhost:3000  
- API docs: http://localhost:4100/docs  
- Admin: http://localhost:3001 (not linked from the public UI)

### Docker Compose

```bash
docker compose up --build
```

## Sandbox accounts (local only)

Documented here only — not shown in the public UI:

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@planet.local` | `PlanetAdmin!23` |
| Explorer | `explorer@planet.local` | `Explorer!23` |

AI defaults to **`AI_PROVIDER=mock`** sandbox. Set provider keys to enable live adapters; without keys the mock remains explicit (`sandbox: true` in responses).

## Core user flow (implemented)

1. Register / login  
2. Open the live 3D planet (rotate/zoom)  
3. Click a region marker → region stats  
4. Add one element → AI structured parse + balance  
5. Pick a region → apply → simulation writes DB events  
6. Event log + timeline update; notifications created  
7. Causal graph stored per contribution  
8. Snapshots taken before apply for compare/rollback  

## Tests

```bash
pnpm --filter @planet/simulation-models test
pnpm --filter @planet/validation test
pnpm --filter @planet/ai-orchestrator test
```

Critical coverage includes: seed determinism, tick replay, contribution application, AI narrative grounding, moderation rejection.

## Docs

- [Architecture](./docs/architecture/overview.md)
- [Simulation algorithms](./docs/algorithms/simulation.md)
- [AI integration](./docs/algorithms/ai-integration.md)
- [API](./docs/api/openapi.md)
- [Database](./docs/database/schema.md)

## Feature honesty

| Capability | Status |
|---|---|
| Deterministic worldgen + ticks + causal apply | **Live** |
| PostgreSQL persistence + seed world (12 civs / 40 cities / 120 resources / 300 species / 800 plants / 50 techs) | **Live** |
| WebGL planet + overlays from data | **Live** |
| AI mock structured output + narration grounded in sim effects | **Live** |
| OpenAI/Anthropic/Gemini adapters | **Adapters present; require keys** |
| PostGIS / pgvector / NATS JetStream | **Compose services ready; advanced geo/vector search marked for next iteration** |
| Full PWA offline pack | **Manifest present; offline cache partial** |

Legacy advertising app sources were moved under `legacy/` and are not part of this product runtime.

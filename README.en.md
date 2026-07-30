# Planet Born Before You

**Your world, your decision, an endless trace.**

Monorepo for a living planetary simulation platform. Algorithms decide outcomes first; AI only structures user ideas and narrates results that already exist in simulation data.

## Working now

- Seeded demo world `kawkab-rich-demo` with 12 civilizations, 40 cities, 120+ resources, 300+ species, 800+ plants, 50+ technologies, and bootstrap history.
- Deterministic event-sourced simulation engine with climate, plants, multi-civ growth, migrations, wars, Monte Carlo futures, snapshots, and rollback.
- Full contribution loop: register/login → analyze/balance → region → preview fork → confirm into live world → persisted events/notifications/timeline/causal links.
- Web dashboard (Arabic RTL default) with R3F planet, event log, contribution wizard, timeline, causal graph, compare, and futures panels.
- Separate admin app with login, users, moderation, and simulation controls.
- Realtime gateway (`ws://localhost:4010`) plus Swagger at `/docs`.

## Honest limits

- AI billing dashboards: **not enabled**.
- OpenAI/Anthropic/Gemini adapters exist; Mock provider always works without keys.
- Local persistence uses SQLite; PostgreSQL is prepared in Docker Compose.
- Production Redis worker queue is not fully wired yet (API writes notifications directly).

## Quick start

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm --filter @kawkab/api db:migrate
pnpm --filter @kawkab/api db:seed
pnpm --filter @kawkab/realtime-gateway dev
pnpm --filter @kawkab/api dev
pnpm --filter @kawkab/web dev
pnpm --filter @kawkab/admin dev
```

Sandbox admin after seed:

- Email: `admin@kawkab.local`
- Password: `change-me-admin`

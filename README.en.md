
# Planet Born Before You

**Your world, your decision, an endless trace.**

A pnpm/Turbo monorepo for a deterministic planetary simulation platform. Algorithms drive the world; AI helps parse and narrate contributions but does not simulate outcomes.

## Working now

- Rich demo seed `kawkab-rich-demo`:
  - target scale: 12 civilizations, 40 cities, 120+ resources, 300+ species, 800+ plants, 50+ technologies.
  - local seed smoke produced: 12 civilizations, 40 cities, 467 resources, 311 species, 1000 plants, 64 technologies, 223 events.
- API loads persisted planet state from SQLite or generates/seeds it on first start.
- End-to-end contribution loop:
  1. Register/login with JWT.
  2. `POST /contributions` parses and balances with the always-available Mock AI provider.
  3. `GET /contributions/:id/preview` applies to a fork, runs short ticks + Monte Carlo, and returns deltas, risks, success probability, and suitable biomes.
  4. `POST /contributions/:id/confirm` applies to live simulation, persists world events/state/snapshots, creates notifications, and broadcasts realtime deltas.
- API includes timeline, causal graph, compare, notification, scenario, and admin moderation/control routes.
- Realtime gateway supports WebSocket clients and `POST /broadcast` from the API.
- Web app includes auth, full contribution wizard, live event refresh, timeline scrubber, causal graph SVG, before/after compare, future scenarios, planet layers, city lights, and event markers.
- Admin app supports real login, user/contribution lists, moderation, and simulation tick/pause/resume.

## Honest unfinished status

- AI cost/billing charts: **غير مفعّل** until provider billing is integrated.
- OpenAI/Anthropic/Gemini are adapter names; Mock provider is the working default.
- Production Redis worker is not wired yet; API currently creates notification records directly.
- Docker provisions PostgreSQL, but local dev persistence currently uses SQLite unless Postgres integration is completed.

## Run locally

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

- Web: <http://localhost:3000>
- Admin: <http://localhost:3001>
- API: <http://localhost:4000>
- Swagger: <http://localhost:4000/docs>
- Realtime: `ws://localhost:4010`, `POST http://localhost:4010/broadcast`

Sandbox admin after seeding:

- Email: `admin@kawkab.local`
- Password: `change-me-admin`

Verification:

```bash
pnpm test
pnpm typecheck
pnpm build
```

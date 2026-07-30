# Planet Born Before You

**Your world, your decision, an endless trace.**

This repository is a pnpm/Turbo monorepo foundation for a planetary simulation platform. It includes deterministic procedural generation, an event-sourced simulation engine, contribution validation, AI provider orchestration with a guaranteed local mock provider, Fastify APIs, WebSocket deltas, and separate public/admin Next.js apps.

## Run locally

```bash
corepack enable
pnpm install
pnpm test
pnpm --filter @kawkab/api db:migrate
pnpm --filter @kawkab/api db:seed
pnpm --filter @kawkab/api dev
pnpm --filter @kawkab/realtime-gateway dev
pnpm --filter @kawkab/web dev
```

- Web: <http://localhost:3000>
- Admin: <http://localhost:3001>
- API: <http://localhost:4000>
- Swagger: <http://localhost:4000/docs>

The simulation is deterministic: same seed plus same events rebuilds the same state. Clearly unfinished production features are labeled **غير مفعّل** in UI/API output.

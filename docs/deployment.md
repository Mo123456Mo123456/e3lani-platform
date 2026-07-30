# Deployment — النشر

## Modes

| Mode | When | What's needed |
|---|---|---|
| Sandbox | dev / demo / CI | Node 22 + pnpm. In-memory store, mock AI. Zero infra. |
| Full local | real persistence | `docker compose up --build` |
| Production | public deployment | compose on a host or split the images; Postgres 16 |

## Docker stack

```bash
cp .env.example .env       # set JWT_SECRET at minimum
docker compose up --build
# web :3000  admin :3100  api :4100  orchestrator :8100  sim-engine :8200  postgres :5432
# optional: --profile bus (NATS)  --profile cache (Redis)
```

The API runs migrations at boot when `DATABASE_URL` is set, provisions the
sandbox accounts idempotently, and creates the default planet if the DB is
empty. For the rich demo world: `DATABASE_URL=... pnpm seed`.

## Production checklist

- [ ] `JWT_SECRET` set (boot refuses the dev default in production)
- [ ] `DATABASE_URL` → managed Postgres; backups + PITR for the event store
- [ ] `AI_PROVIDER` + provider key, `AI_ORCHESTRATOR_URL` → orchestrator
- [ ] `CORS_ORIGINS` restricted to real origins
- [ ] `RATE_LIMIT_MAX` reviewed; per-route limits on analyze/place/auth
- [ ] TLS termination in front of api/web/admin (Caddy/Traefik/ALB)
- [ ] `AUTO_TICK=true` with a sane `AUTO_TICK_INTERVAL_MS` (≥ 3000)
- [ ] Sandbox accounts **disabled or re-passworded**
- [ ] Log shipping + metrics (structured logs are JSON; health at `/health`,
      readiness at `/ready`)
- [ ] WebGL quality default `medium` for mobile-heavy audiences

## Environment reference

See `.env.example` — every variable documented, with safe sandbox defaults
for anything not required.

## CI

`.github/workflows/ci.yml`: install → typecheck (all packages) → vitest →
pytest (both Python services) → build web + admin → build all Docker images.

## Load testing

```bash
node scripts/load-test.mjs 15 12
```

Mixed traffic (events reads, grid-config, analyze) with latency percentiles
and error-rate reporting. 429 responses are reported separately as the rate
limiter working as designed.

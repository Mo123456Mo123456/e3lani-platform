# Deployment

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Published ports: web `3000`, admin `3001`, api `4000`, realtime `4001`, sim `8001`, ai `8002`, postgres `5432`, redis `6379`, minio `9000/9001`.

Dockerfiles: `infra/docker/Dockerfile.*`.

## Environment

Critical variables (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Access & refresh signing (≥32 chars) |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Seed bootstrap |
| `SQLITE_PATH` / `DATABASE_URL` | Local vs Postgres |
| `SIM_ENGINE_URL` / `AI_ORCHESTRATOR_URL` / `REALTIME_URL` | Service mesh |
| `AI_PROVIDER` + provider keys | Live AI vs mock |
| `INTERNAL_API_KEY` | Service-to-service publish |
| `WEB_URL` / `ADMIN_URL` | CORS allowlist |
| `S3_*` | MinIO / S3 |
| `NEXT_PUBLIC_API_URL` | Browser → API |

## Production checklist

- [ ] Rotate all secrets; never ship `.env` with defaults
- [ ] Use Postgres + managed backups; run migrations before cutover
- [ ] Put **admin** behind VPN / SSO / IP allowlist — no public marketing link
- [ ] Set CORS to exact `WEB_URL` + `ADMIN_URL`
- [ ] Enable rate limits; tune `RATE_LIMIT_*`
- [ ] Run sim + AI as separate scalable services; health-check both
- [ ] Prefer real AI providers only with moderation + spend caps
- [ ] TLS termination at reverse proxy; HSTS
- [ ] Confirm `/admin/health-detail` green after deploy
- [ ] Seed Super Admin once; then change password
- [ ] Object storage credentials scoped to bucket `planet`
- [ ] CI green (`.github/workflows/ci.yml`)

## Scaling notes

- API is stateless aside from SQLite — switch to Postgres for multi-instance.
- Realtime gateway should share Redis for multi-node fan-out (when enabled).
- Simulation must remain single-writer per planet (or shard by `planetId`).

## Related

- [security.md](./security.md)
- [architecture.md](./architecture.md)

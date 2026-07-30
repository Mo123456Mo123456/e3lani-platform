# Deployment

## Compose

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up -d --build
```

Services: postgres (pgvector), redis, nats, minio, api, simulation, ai, realtime, web, admin.

## Migrations

```bash
pnpm --filter @planet/db exec prisma migrate deploy
pnpm db:seed
```

## Health checks

- API `GET /health`
- Simulation `GET /health`
- AI `GET /health`
- Realtime `GET /health`

## Secrets

Inject via orchestrator secrets — never bake keys into images. Rotate JWT secrets and sandbox passwords before public exposure.

## Scaling notes

- Simulation engine is CPU-bound; scale horizontally per-planet workers.
- API is stateless behind load balancer; sticky sessions not required (JWT).
- Realtime gateway scales with Redis pub/sub fanout.

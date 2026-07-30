# Deployment

## Docker Compose

```bash
cp .env.example .env
# set JWT_SECRET and disable AI_SANDBOX_MODE only when keys exist
docker compose up -d --build
```

Services: postgres, redis, api, simulation, ai, web, admin.

## Environment

See `.env.example`. Never commit real secrets.

## Health

- API: `GET /health`
- AI: `GET http://localhost:8002/health`
- Sim: `GET http://localhost:8001/health`
- OpenAPI: `http://localhost:4000/docs`

## CI

GitHub Actions runs install, simulation unit tests, and TypeScript checks on push/PR.

## Production checklist

- [ ] Rotate sandbox passwords
- [ ] Strong `JWT_SECRET`
- [ ] TLS termination
- [ ] Managed Postgres + backups
- [ ] Redis persistence policy
- [ ] AI keys in secret manager
- [ ] CSP tightened for admin
- [ ] Separate admin ingress / IP allowlist

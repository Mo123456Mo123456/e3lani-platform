# Staging runbook — E3lani | إعلاني

## URLs

| Service | URL |
|---|---|
| API | https://e3lani-api-staging.onrender.com |
| Health | https://e3lani-api-staging.onrender.com/api/v1/health |
| Ready | https://e3lani-api-staging.onrender.com/api/v1/health/ready |
| Swagger | https://e3lani-api-staging.onrender.com/api/docs |
| Web | https://e3lani-web-staging.onrender.com |
| Admin | https://e3lani-admin-staging.onrender.com |

Branch for auto-deploy: `cursor/phase-1-foundation-b0e4`

## Bootstrap

API start runs `prisma migrate deploy` then seeds SA geo/categories/pricing when empty (`ensure-seed.ts`). Pricing catalog upserts to **19/5/5/10/20/15/5 SAR**.

## Storage

Blueprint default: sandbox (`STORAGE_PROVIDER=sandbox`).  
If Cloudflare R2 dashboard secrets are set and `STORAGE_PROVIDER=r2`, the R2 adapter is used (production-capable). Keep R2_* names only.

## Smoke

```bash
# Allow ~2 minutes for Render Free cold start
API_URL=https://e3lani-api-staging.onrender.com/api/v1 node scripts/staging-smoke.mjs
```

Sandbox OTP code: `123456`

## Manual deploy trigger

Push to the staging branch (autoDeploy) or sync Blueprint:

```bash
export RENDER_API_KEY=...
bash scripts/deploy-staging-render.sh
```

## Required dashboard env (non-secret)

- `API_PUBLIC_URL=https://e3lani-api-staging.onrender.com`
- `CORS_ORIGINS=https://e3lani-web-staging.onrender.com,https://e3lani-admin-staging.onrender.com`
- Web/Admin: `NEXT_PUBLIC_API_URL=https://e3lani-api-staging.onrender.com/api/v1`

## Production keys (do not put in Git)

Listed in `COMPLETION_REPORT.md`.

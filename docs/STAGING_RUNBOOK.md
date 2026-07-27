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

API start runs `prisma migrate deploy` then seeds SA geo/categories/pricing when empty (`ensure-seed.ts`). Pricing catalog upserts to **59/10/29/15/29/29/10 SAR** (publish tax-inclusive).

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

## Required env (Blueprint-owned)

Pinned in `render.yaml` for `e3lani-api-staging`:

- `API_PUBLIC_URL=https://e3lani-api-staging.onrender.com`
- `CORS_ORIGINS=https://e3lani-web-staging.onrender.com,https://e3lani-admin-staging.onrender.com`
- `SANDBOX_PAYMENT_WEBHOOK_SECRET=e3lani-staging-sandbox-webhook-secret` (staging-only; never reuse in production)

Web/Admin Blueprint:

- `NEXT_PUBLIC_API_URL=https://e3lani-api-staging.onrender.com/api/v1`

### Full smoke (admin + signed webhook)

```bash
API_URL=https://e3lani-api-staging.onrender.com/api/v1 \
SANDBOX_PAYMENT_WEBHOOK_SECRET=e3lani-staging-sandbox-webhook-secret \
pnpm test:full-staging-smoke
```

Optional: `ADMIN_ACCESS_TOKEN=...` (otherwise smoke uses a second sandbox OTP session; `PAYMENT_MODE=sandbox` opens admin routes).

## Production keys (do not put in Git)

Listed in `COMPLETION_REPORT.md`.

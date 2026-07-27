# Android Staging Release v5 — Render durable API

## Artifact

| Field | Value |
|---|---|
| File | `e3lani-staging-release-v5.apk` |
| Download | https://github.com/Mo123456Mo123456/e3lani-platform/releases/download/visual-qa-phase3/e3lani-staging-release-v5.apk |
| Package | `sa.e3lani.app` |
| Version name | `0.1.5-staging` |
| Version code | `5` |
| SHA-256 | `ba49bde90a6ec225baf55b81bc8e61ade8818ac8d8f9725e68f6afcdb30a3cfe` |
| Size | ~68 MB |
| Signing | Staging keystore (`CN=E3lani Staging`) |

## Embedded API (durable — not trycloudflare)

| Service | URL |
|---|---|
| API | https://e3lani-api-staging.onrender.com |
| Health | https://e3lani-api-staging.onrender.com/api/v1/health |
| Web | https://e3lani-web-staging.onrender.com |
| Admin | https://e3lani-admin-staging.onrender.com |

Bundle contains `https://e3lani-api-staging.onrender.com/api/v1` only (no localhost / trycloudflare).

## Host API flow verification (2026-07-27)

| Step | Result |
|---|---|
| Health | 200 `{"status":"ok"}` |
| Admin | 200 |
| Web | 200 |
| OTP request + verify `123456` | OK → accessToken |
| Feed | OK `{ items, nextCursor, hasMore }` |
| Categories / cities seed | 21 categories, 5 cities (bootstrap seed) |
| Create ad (DRAFT) | OK |
| Media upload-intent | **503 STORAGE_NOT_CONFIGURED** — set `S3_*` on Render API service |

## Build

```bash
# apps/mobile/.env.staging
EXPO_PUBLIC_API_URL=https://e3lani-api-staging.onrender.com/api/v1
pnpm --filter @e3lani/mobile build:android:staging-release
# → apps/mobile/dist/e3lani-staging-release-v5.apk
```

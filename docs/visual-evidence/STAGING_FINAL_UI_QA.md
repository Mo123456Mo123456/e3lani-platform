# Staging Final UI Verification

Date: 2026-07-27  
Branch: `cursor/phase-1-foundation-b0e4`  
Tip at verification start: `42f913d`  
PR: #2 (Draft — not Ready, not merged)

## Live URLs

| Surface | URL |
|---|---|
| Web | https://e3lani-web-staging.onrender.com |
| Admin | https://e3lani-admin-staging.onrender.com |
| API | https://e3lani-api-staging.onrender.com/api/v1 |

## 1) Web — PASS

Suite: `tests/e2e/staging-final-qa.spec.ts` against live Render.

| Check | Result |
|---|---|
| Home | PASS (200, RTL) |
| Browse | PASS |
| Categories | PASS |
| Search | PASS |
| Pricing | PASS |
| Saved | PASS |
| Account | PASS |
| Terms / Privacy / Content-policy / FAQ / Cities | PASS |
| RTL → LTR language toggle | PASS |
| OTP login (sandbox 123456) | PASS |
| Create-ad page | PASS |
| Ad detail (live ACTIVE ad) | PASS |
| No localhost requests | PASS |
| No API 4xx/5xx | PASS |

Evidence: `/opt/cursor/artifacts/staging-final-qa/web-*.png`  
Report: `/opt/cursor/artifacts/staging-final-qa/STAGING_FINAL_QA_REPORT.md`

## 2) Admin — PASS (live API, not mock)

| Check | Result |
|---|---|
| Login | PASS → `/ads/review` |
| Dashboard KPIs | PASS — calls `admin/ads/review`, `admin/reports`, … |
| Ad review + approve/reject controls | PASS |
| Users | PASS — `admin/users` |
| Reports | PASS — `admin/reports` |
| Appeals | PASS — live appeals from smoke (`الاعتراضات`) |
| Payments | PASS — sandbox paid txs via webhook |
| Refunds / Campaigns / Pricing / Audit / Orders | PASS |
| No localhost | PASS |

Evidence: `/opt/cursor/artifacts/staging-final-qa/admin-*.png`

## 3) Mobile APK/AAB v6

| Artifact | SHA-256 |
|---|---|
| `e3lani-staging-release-v6.apk` | `ffeae70897f95a1bfe0abf64583813da4cacb7135be352f4c4f3bb7ba5426b97` |
| `e3lani-staging-release-v6.aab` | `87a096aa54d844c5910696b9a9a2eef4871ec64d59096fd0a421130e22f342d0` |

| Check | Result |
|---|---|
| Bundle API host | PASS — only `https://e3lani-api-staging.onrender.com/api/v1` |
| No `127.0.0.1:3001` API | PASS |
| No Metro/`Unable to load script` | PASS (release embeds JS bundle) |
| Deep link schemes in manifest | PASS — `e3lani://`, `sa.e3lani.app://` |
| Emulator cold UI (AR nav) | PASS — Home/Categories/Saved/Account/+ visible |
| Emulator live OTP/feed/upload | BLOCKED — emulator network down (`eth0` no IPv4 / `Network is unreachable`) |
| System UI ANR on emulator | Observed (host emulator instability, not Metro) |
| Mobile API smoke (shared client) | PASS via Playwright `mobile API path smoke` |

Evidence: `/opt/cursor/artifacts/mobile-v6-qa/` (`launch-4.png` shows staging URL + Arabic shell; prior release shots under `docs/visual-evidence/android-release-*.png`)

## 4) Visual QA / full e2e

- Fixed e2e to upload **image + video** (`minImages=1`).
- Fixed hardcoded `127.0.0.1` brand fetch in `visual-qa.spec.ts`.
- Playwright `WEB_URL`/`BASE_URL` support.
- Re-run against staging after fixture fix (see CI/agent log `/tmp/e2e-staging2.out`).

## Remaining defects / environment limits

1. **Emulator networking**: no IPv4 on `eth0` → mobile cannot reach Render API from this VM emulator. App correctly targets staging and shows timeout UI (not white screen / not Metro).
2. **API error copy**: English `At least 1 image required` surfaced on web preview when only video uploaded — localized to Arabic in API (this tip).
3. **api-client payment redirect defaults**: were `localhost:3000`; now default to staging web origin / `EXPO_PUBLIC_WEB_URL` (activation still webhook-only).
4. **`localhost:8081` string** remains inside Expo URL-parser fallback in the release bundle; not used as Metro connection in release (confirmed no DevServerHelper connect).

## Commands

```bash
WEB_URL=https://e3lani-web-staging.onrender.com \
ADMIN_URL=https://e3lani-admin-staging.onrender.com \
API_URL=https://e3lani-api-staging.onrender.com/api/v1 \
pnpm exec playwright test tests/e2e/staging-final-qa.spec.ts

WEB_URL=… ADMIN_URL=… API_URL=… BASE_URL=… \
pnpm exec playwright test tests/e2e/visual-qa.spec.ts tests/e2e/full-flow.spec.ts
```

## Update after tip `6c114d1`+

- Web create: multi-file image+video — PASS on live staging
- `full-flow.spec.ts` against staging — **PASS** (OTP → create image+video → admin approve → sandbox pay → ACTIVE → feed + video player)
- `visual-qa` desktop flow — functional path PASS; Chromium `ERR_BLOCKED_BY_ORB` on some cross-origin media requests filtered; API download now sets `Cross-Origin-Resource-Policy: cross-origin`
- Viewport iphone/android + mobile API smoke — PASS
- Remaining: emulator has no IPv4 outbound in this cloud VM (app UI + staging API URL confirmed; live OTP/upload blocked by host network)

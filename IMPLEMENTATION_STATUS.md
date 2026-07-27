# Implementation Status — E3lani | إعلاني

Branch: `cursor/phase-1-foundation-b0e4`  
Audit date: 2026-07-27  
Source of truth for remaining work: `CURSOR_MASTER_EXECUTION.md`

## Executive summary

Core staging path works in part: **sandbox OTP → draft ad → media intent → review → sandbox payment → feed**.  
Large gaps remain for auth rotation, discovery/search, notifications, analytics, campaigns, admin completeness, SEO, CI, and the **sandbox storage adapter** claimed by `render.yaml` (code currently requires `R2_*` only).

Pricing in code is **59 SAR** catalog; master brief requires **19/5/5/10/20/15/5 SAR** — will be aligned in foundation phase.

## Legend

| Tag | Meaning |
|---|---|
| DONE | Usable end-to-end for that slice |
| PARTIAL | Models/UI/API incomplete |
| MISSING | Not implemented |

## Backend / API

| Area | Status | Notes |
|---|---|---|
| OTP sandbox | DONE | `packages/auth`, `POST /auth/request-otp`, `verify-otp` |
| Production OTP adapter | PARTIAL | Fail-closed placeholder only |
| JWT access | DONE | 15m access token |
| Refresh rotation / logout | MISSING | Session hash stored; no `/auth/refresh` or revoke |
| Roles + permissions map | DONE | Prisma `Role` + `packages/auth/permissions` |
| Profile update / suspension APIs | PARTIAL | Schema fields; limited APIs |
| Audit log writes | PARTIAL | Model exists; few/no writes |
| Ad state machine | PARTIAL | Transitions exist; pause/schedule/expire/republish APIs thin |
| Pricing engine | PARTIAL | Engine DONE; amounts diverge from master brief |
| Sandbox payments + webhooks | DONE | HMAC sandbox checkout |
| Production payment adapters | MISSING | Interface + disabled stubs |
| Refunds API | MISSING | |
| Categories + SA geo seed | DONE | 21 categories + cities; bootstrap seed |
| Feed tabs | PARTIAL | forYou/latest; nearby stubs |
| Search / filters | MISSING | |
| Saved ads | DONE | |
| Sharing | MISSING | |
| Media signed upload + inline process | PARTIAL | R2 path DONE; sandbox storage claimed in Render **MISSING in code** |
| Media worker | PARTIAL | Code present; not on Render Free |
| Admin review queue | DONE | approve / needs-changes / reject |
| Reports / appeals APIs | MISSING | Report model only |
| Notifications | MISSING | Model only |
| Analytics ingest | MISSING | Model only |
| Enterprise campaigns | MISSING | |
| Health / ready | DONE | Includes storage summary |
| Rate limiting | MISSING | |
| CORS | DONE | `CORS_ORIGINS` |
| GitHub Actions CI | MISSING | No `.github/workflows` |
| Migrations | DONE | Init migration + `migrate deploy` on Render |

## Web (`apps/web`)

| Area | Status |
|---|---|
| Landing, browse, ad detail, brand, create, pricing, account, login, saved | DONE / PARTIAL |
| Cities page, search, FAQ, terms/privacy, enterprise | MISSING |
| Advertiser analytics dashboard | PARTIAL |
| SEO sitemap/robots/OG | PARTIAL / MISSING |
| AR/EN path routing | PARTIAL (client locale only) |

## Admin (`apps/admin`)

| Area | Status |
|---|---|
| Ads review, orders/payments lists, login | DONE / PARTIAL |
| KPIs, users/roles, verification, reports, categories CRUD, pricing admin, refunds, campaigns, templates, flags, health UI, audit | MISSING |

## Mobile (`apps/mobile`)

| Area | Status |
|---|---|
| OTP login, vertical feed, create+upload, saved, account, staging APK pipeline | DONE / PARTIAL |
| Search/filters, notifications, deep-link handlers, progress bar, EN locale | PARTIAL / MISSING |

## Infrastructure

| Item | Status |
|---|---|
| Render Blueprint (API/Web/Admin + PG + Redis) | DONE |
| `STORAGE_PROVIDER=sandbox` in `render.yaml` | CLAIMED — code must implement sandbox adapter |
| R2 production adapter | DONE (`R2_*` env) |
| Inline media on Free tier | DONE (`MEDIA_PROCESSING_MODE=inline`) |

## Phase plan (execution)

1. **Foundation** — status doc (this file), sandbox storage, pricing alignment, CI, scripts/env templates  
2. **API** — refresh/logout, profile, search/filters, ad pause/republish/extend, reports/appeals, notifications, analytics, campaigns skeleton, rate limit, Swagger polish  
3. **Adapters** — payments placeholders, moderation sandbox, notification sandbox, analytics aggregation  
4. **Web** — missing pages, SEO, discovery UX  
5. **Admin** — remaining portals  
6. **Mobile** — gaps + deep links  
7. **Seed + E2E** — staging validation  
8. **Deploy docs / Render sync**  
9. **COMPLETION_REPORT.md** + root quality gates  

## Blockers requiring external keys (sandbox elsewhere)

| Variable | Provider | Staging approach |
|---|---|---|
| `R2_*` | Cloudflare R2 | Sandbox storage adapter OR dashboard secrets |
| Production OTP | Unifonic/Twilio/SNS | Sandbox OTP `123456` |
| Production payments | Moyasar/etc. | Sandbox payment webhooks |
| Push / SMS / Email prod | FCM/APNs/ESP | Sandbox notification adapters |

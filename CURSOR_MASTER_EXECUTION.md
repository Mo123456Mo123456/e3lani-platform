# E3lani | إعلاني — Autonomous Full Build Execution Brief

You are the lead staff engineer responsible for finishing the E3lani platform end-to-end on branch `cursor/phase-1-foundation-b0e4`.

## Non-negotiable execution mode

- Do not stop after scaffolding, mock screens, or partial wiring.
- Implement working code, database models, migrations, API routes, background jobs/adapters, web, admin, and mobile integration.
- When a third-party production key is unavailable, create a provider adapter, documented environment variable placeholder, sandbox/mock implementation, health check, and clear production-readiness status. Never fake production success.
- Keep all secrets out of Git.
- Work in sequential, reviewable commits and push every completed phase to the same branch.
- Before each phase commit, run install, lint, typecheck, tests, and relevant builds. Fix failures rather than skipping them.
- Preserve existing working Render, PostgreSQL, Redis, and Cloudflare R2 configuration.
- Do not remove production-capable adapters when enabling sandbox fallbacks.

## Product definition

E3lani is a Saudi visual advertising platform, not an e-commerce marketplace.

Users browse vertical image/video ads and contact the advertiser through store link, WhatsApp, or phone.

Forbidden in v1:
- no cart
- no in-app checkout for products
- no sales commission
- no delivery
- no auction
- no internal chat
- no comments
- no mandatory product price
- no image-to-video conversion

## Brand and UX

- Arabic RTL and English LTR.
- Brand: `إعلاني | E3lani`
- Tagline: `منصة الإعلانات المرئية لكل شيء`
- Colors: white, `#FFC400`, black `#111111`, gray `#F7F7F7`, borders `#E8E8E8`.
- Clean Gulf/Saudi visual language.
- Mobile-first, accessible, responsive.
- Vertical feed, autoplay muted, manual sound toggle.
- Image ads support horizontal swipe.

## Repository architecture

Use the existing pnpm/Turborepo structure:

- `apps/mobile`
- `apps/web`
- `apps/admin`
- `services/api`
- `services/media-worker`
- shared packages already present in the monorepo

Do not replace the stack unless a hard blocker exists.

## Required complete scope

### 1. Authentication and accounts

Implement:
- phone registration and login using OTP
- sandbox OTP provider for staging
- production OTP adapter placeholders
- user profile: name, phone, optional email, city, avatar
- advertiser type: individual, store/brand, company
- JWT access/refresh rotation
- logout/revocation
- role-based authorization
- account suspension and audit trail

Roles:
- guest
- user
- individual advertiser
- store/brand
- enterprise advertiser
- ad moderator
- support
- campaign manager
- finance manager
- super admin

### 2. Advertising lifecycle

Implement database, API, validation, UI, admin workflows, and tests for:

Statuses:
- draft
- pending_payment
- payment_failed
- pending_review
- needs_changes
- approved
- scheduled
- active
- paused
- rejected
- expired
- removed
- refunded

Fields:
- required title
- optional description
- required category and optional subcategory
- city and coverage: city or nationwide
- one contact destination: store URL, WhatsApp, or phone
- optional price mention only in description/media
- media: video or 1–5 images

Media constraints:
- video <= 60 seconds and <= 200 MB
- image/video validation
- MP4/MOV/JPG/PNG/WebP
- portrait-first 9:16
- thumbnail generation
- safe metadata stripping
- no image-to-video conversion

Rules:
- content edits after approval trigger re-review
- pausing does not refund and does not stop expiry timer
- scheduled activation and expiry jobs
- republish and extension purchase handling

### 3. Pricing and billing

Implement the confirmed pricing model:

- Normal ad: 59 SAR / 30 days (tax-inclusive when VAT applies; user pays 59)
- Republish: 10 SAR
- Extend 15 days: 29 SAR
- Highlight 3 days: 15 SAR
- Highlight 7 days: 29 SAR
- Top of category: 29 SAR
- City targeting add-on: 10 SAR

Build:
- pricing configuration tables
- order/invoice/payment entities
- immutable money snapshots per order
- sandbox payment provider
- production payment adapter interface and env placeholders
- webhook verification
- idempotency
- failed payment recovery
- refund workflow and finance admin views
- no fake paid state in production mode

### 4. Categories and discovery

Seed and manage categories including:
- vehicles
- real estate
- electronics
- furniture
- fashion
- services
- jobs
- equipment
- permitted animals
- games
- rentals
- home products
- home businesses
- tickets
- permitted health and beauty
- education
- travel
- restaurants
- brands
- exchange/donation
- other

Implement:
- category/subcategory management
- cities and Saudi regions seed data
- feed tabs: For You, Nearby, Latest, Categories
- search
- filters: city, category, nearby, image/video, latest, most viewed, verified, featured/sponsored
- pagination/cursor loading
- fair sponsored distribution and frequency caps
- saved ads
- sharing

### 5. Feed and ad experience

Implement production-quality web and mobile experiences:
- vertical full-screen feed
- preloading and adaptive media behavior
- autoplay muted
- sound toggle
- progressive image loading
- video poster/thumbnail
- advertiser identity and verified badge
- clear sponsored badge
- save/share/report/contact actions
- deep links
- graceful offline/error states
- analytics event emission without blocking UX

### 6. Advertiser and brand pages

Implement:
- public brand profile
- logo, cover, bio, links, cities
- active ads
- aggregate views
- share profile
- verification status
- advertiser dashboard
- create/edit/pause/republish/extend/promote ads
- payment history
- ad performance analytics

### 7. Analytics

Track and expose:
- impressions
- unique reach
- video views
- average watch duration
- completion rate
- store/WhatsApp/phone clicks
- saves
- shares
- top city/day/hour
- source of impression
- organic vs paid

Requirements:
- privacy-conscious identifiers
- deduplication rules
- ingestion endpoint
- aggregation jobs
- advertiser dashboards
- admin summaries
- tests for event validation and aggregation

### 8. Moderation, reports, and appeals

Implement:
- automated moderation adapter interface
- sandbox moderation implementation
- manual review queue
- approve/reject/request changes
- structured rejection reasons
- user report reasons
- appeal workflow
- moderator notes
- full audit log
- role restrictions

### 9. Notifications

Implement notification domain and adapters for:
- payment state
- review state
- approval/rejection
- changes requested
- scheduled activation
- expiry warning
- expiry
- extension/republish
- report/appeal outcomes
- promotions

Provide:
- in-app notification center
- read/unread state
- push adapter placeholders
- SMS/email adapter placeholders
- sandbox implementations

### 10. Enterprise campaigns

Implement campaign management for larger advertisers:
- objectives: views, visits, launch, city/category targeting, sponsorship, opening, seasonal, multi-ad
- budget and scheduling model
- campaign-ad relationships
- campaign manager/admin workflows
- analytics rollups
- sandbox billing support

### 11. Admin portal

Complete admin functions:
- dashboard KPIs
- users and roles
- advertiser verification
- ads review queue
- reports and appeals
- categories and cities
- pricing and promotions
- payments/refunds
- enterprise campaigns
- notifications templates
- feature flags
- system health
- audit logs

### 12. Web application

Complete pages:
- landing/home
- feed/browse
- categories
- cities
- search
- ad details
- brand profile
- add ad flow
- pricing
- enterprise campaigns
- account
- advertiser dashboard
- FAQ
- terms/privacy/content policies

SEO:
- metadata
- sitemap
- robots
- canonical links
- Open Graph
- structured data where appropriate
- Arabic and English routing

### 13. Mobile application

Finish the mobile app with:
- onboarding/auth
- vertical feed
- categories/search/filters
- create ad
- media upload progress
- saved ads
- notifications
- profile and advertiser dashboard
- deep linking
- error and offline handling
- environment-based API configuration
- release build configuration placeholders for Android/iOS

### 14. Media pipeline

Production architecture:
- Cloudflare R2 adapter
- signed upload/download URLs
- bucket/path conventions
- MIME and size validation
- thumbnail generation
- video probing/transcoding hooks
- moderation hooks
- cleanup on failed/draft expiry
- retry and idempotency

Staging may run inline on Render Free, but keep `services/media-worker` production-ready for paid/self-hosted deployment.

### 15. Infrastructure and environments

Provide complete environment templates for:
- local
- test
- staging
- production

Include placeholders/adapters for:
- PostgreSQL
- Redis
- Cloudflare R2
- OTP provider
- payment provider
- email
- SMS
- push notifications
- error monitoring
- analytics
- moderation AI

Requirements:
- `.env.example` files with descriptions and no secrets
- startup validation with clear missing-key output
- health/readiness endpoints
- migrations and seed commands
- Render staging blueprint
- production deployment documentation
- GitHub Actions CI for lint/typecheck/test/build
- optional deployment workflow requiring GitHub secrets

### 16. Security and compliance

Implement:
- strict input validation
- rate limiting
- secure headers
- CORS allowlists
- authorization guards
- signed media access where required
- webhook signatures
- idempotency keys
- secret-safe logging
- PII redaction
- audit logs
- account deletion/export workflow
- privacy and terms placeholders suitable for legal review

### 17. Testing and quality gates

Add meaningful tests for core paths:
- auth and OTP sandbox
- ad lifecycle
- payments and webhooks
- media config and signed uploads
- moderation
- reports/appeals
- analytics ingestion
- authorization

Required final commands must pass from repository root:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If existing scripts differ, normalize them and document exact commands.

## Final deliverables

Do not declare completion until all of the following exist:

1. Working API with Swagger/OpenAPI.
2. Working web application connected to the staging API.
3. Working admin portal connected to the staging API.
4. Working mobile application connected to the staging API.
5. PostgreSQL migrations and seed data.
6. Redis-backed queues/cache where appropriate.
7. Cloudflare R2 production adapter plus staging-ready configuration.
8. Sandbox adapters for missing external providers.
9. Full `.env.example` documentation.
10. CI passing.
11. Deployment/runbook documentation.
12. A `COMPLETION_REPORT.md` containing:
   - completed modules
   - exact URLs and commands
   - remaining production keys only
   - known limitations
   - test/build results
   - production launch checklist

## Execution order

Execute without asking for confirmation unless a destructive action or an unavailable third-party credential blocks progress:

1. Audit current repository and write `IMPLEMENTATION_STATUS.md`.
2. Fix foundation, scripts, shared types, database, migrations, and CI.
3. Complete API modules and tests.
4. Complete media, payments, notifications, moderation, and analytics adapters.
5. Complete web.
6. Complete admin.
7. Complete mobile.
8. Seed staging data and validate end-to-end flows.
9. Deploy/update staging services.
10. Produce `COMPLETION_REPORT.md`.

When a production secret is missing, finish everything else and list the exact variable name, provider page, expected format, and validation method in `COMPLETION_REPORT.md`.

Begin now. Do not return a plan only. Execute the work, commit each phase, push to the same branch, and continue until the full build and verification are complete.
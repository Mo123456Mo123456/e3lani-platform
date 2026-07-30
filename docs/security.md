# Security

## Authentication

- Passwords hashed with **bcrypt**.
- Short-lived **JWT access** tokens + rotating **refresh** tokens bound to `sessions`.
- Endpoints use `authenticate` / `requireRoles` preHandlers (`services/api/src/auth/`).

## RBAC

Hierarchy (level ascending):

`visitor` → `user` → `explorer` → `life_maker` → `civ_creator` → `historian` → `content_mod` → `sim_manager` → `admin` → `super_admin`

- Admin UI allows only `admin`, `super_admin`, `sim_manager`, `content_mod`.
- Granting `super_admin` requires an existing `super_admin` actor.
- Role changes write `audit_logs`.

## Moderation

- Local pattern blocklist (harm / adult / hate, EN+AR) on contributions.
- AI orchestrator adds prompt-injection detection and soft omnipotence flags.
- Moderators approve/reject via `/admin/contributions/:id/*`; results in `moderation_results`.

## Admin surface

- Separate origin (`:3001`); **no link from public web**.
- `robots: noindex` on admin layout metadata.
- Super Admin credentials documented in README only.

## CSP / browser notes

Recommended reverse-proxy headers for web + admin:

```
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; connect-src 'self' https: wss:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Next.js may need CSP nonces for inline scripts in stricter deployments — start with report-only.

## API hardening

- `@fastify/rate-limit` enabled.
- CORS restricted to `WEB_URL` / `ADMIN_URL` when set.
- Internal publish requires `x-internal-key`.
- Zod validation on mutating bodies; generic 500 messages without stack leakage to clients.

## Secrets

Never commit `.env`. Rotate `JWT_*`, `INTERNAL_API_KEY`, DB, and S3 credentials on incident. Sandbox Super Admin password must be changed before any shared environment.

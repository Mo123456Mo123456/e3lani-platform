# Android Staging Release v4

## Previous APK embedded API (v3)

`https://guru-beverly-basename-toilet.trycloudflare.com/api/v1`

That host was an ephemeral Cloudflare quick tunnel (worked from many regions, but not durable / could fail from some mobile networks).

## v4 artifact

| Field | Value |
|---|---|
| File | `e3lani-staging-release-v4.apk` |
| Download | https://github.com/Mo123456Mo123456/e3lani-platform/releases/download/visual-qa-phase3/e3lani-staging-release-v4.apk |
| Package | `sa.e3lani.app` |
| versionName | `0.1.4-staging` |
| versionCode | `4` |
| SHA-256 | `dbf17ea52a99a80d4765c06c8907ad56d74919494593c40e052102cfec73d362` |
| `debuggable` | false |
| Cleartext HTTP | disabled |
| Network security config | system CAs only |

## Staging endpoints (this agent session)

| Service | URL |
|---|---|
| API | https://loud-evening-insert-satellite.trycloudflare.com |
| Health (open on phone first) | https://loud-evening-insert-satellite.trycloudflare.com/api/v1/health |
| Web | https://can-according-score-advertisement.trycloudflare.com |
| Admin | https://lawrence-together-screw-demonstrated.trycloudflare.com |
| Media/MinIO | https://met-donate-anymore-drug.trycloudflare.com |

Build-time env:

`EXPO_PUBLIC_API_URL=https://loud-evening-insert-satellite.trycloudflare.com/api/v1`

## Staging lifetime

- **While this Cursor cloud-agent session remains running** (supervised `cloudflared` keepalive ~45s).
- VM inbound ports are blocked; no free durable PaaS credentials exist in-environment, so public HTTPS uses supervised Cloudflare quick tunnels.
- For a permanent hostname (e.g. `staging-api.e3lani.sa`), use a **named** Cloudflare Tunnel + domain, or Railway/Fly/Render.

## App UX improvements

- 20s request timeout
- Arabic connection-error UI with server status + retry
- OTP login sends `deviceId: e3lani-android`

## Preflight checks (passed before packaging)

- `GET /api/v1/health` → 200 from agent + external checkers (CA/ES/SE OK)
- OTP request + verify (`123456`) → access token
- Feed → items returned
- TLS certificate verify OK (Cloudflare edge)
- APK bundle contains `https://loud-evening-insert-satellite.trycloudflare.com/api/v1` (not localhost)

**Before installing:** open the Health URL in your phone browser. If it fails there, the APK cannot reach the API from that network either.

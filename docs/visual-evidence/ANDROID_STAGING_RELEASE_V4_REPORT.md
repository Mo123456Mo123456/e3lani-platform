# Android Staging Release v4

## Previous APK embedded API (v3)

`https://guru-beverly-basename-toilet.trycloudflare.com/api/v1`

That host was an ephemeral Cloudflare quick tunnel (worked from many regions, but not durable).

## v4 artifact

| Field | Value |
|---|---|
| File | `e3lani-staging-release-v4.apk` |
| Download | https://github.com/Mo123456Mo123456/e3lani-platform/releases/download/visual-qa-phase3/e3lani-staging-release-v4.apk |
| Package | `sa.e3lani.app` |
| versionName | `0.1.4-staging` |
| versionCode | `4` |
| SHA-256 | `015c49197b3353bdf8f07a30534cddbcfbc33b04c42f828aabe6385f41f26f68` |
| Built at (UTC) | `2026-07-27T02:17:30Z` |
| `debuggable` | false |
| Cleartext HTTP | disabled |
| Network security config | system CAs only |

## Staging endpoints (this agent session)

| Service | URL |
|---|---|
| API | https://loud-evening-insert-satellite.trycloudflare.com |
| Health | https://loud-evening-insert-satellite.trycloudflare.com/api/v1/health |
| Web | https://can-according-score-advertisement.trycloudflare.com |
| Admin | https://lawrence-together-screw-demonstrated.trycloudflare.com |
| Media/MinIO | https://met-donate-anymore-drug.trycloudflare.com |

Build-time env: `EXPO_PUBLIC_API_URL=https://loud-evening-insert-satellite.trycloudflare.com/api/v1`

## Staging lifetime

- **While this Cursor cloud-agent session remains running** (supervised `cloudflared` keepalive every ~45s).
- VM inbound ports are blocked; no free durable PaaS credentials are available in-environment, so public HTTPS is provided via supervised Cloudflare quick tunnels.
- For a permanent hostname (e.g. `staging-api.e3lani.sa`), a named Cloudflare Tunnel + domain (or Railway/Fly/Render) is required.

## App UX improvements

- 20s request timeout
- Arabic connection error screen with server status + retry
- OTP login sends `deviceId: e3lani-android`

## Preflight checks

- `GET /api/v1/health` → 200
- OTP request + verify (`123456`) → access token
- Feed → items returned
- TLS certificate verify OK (Cloudflare edge)

**Before installing:** open the Health URL above in your phone browser. If it fails there, the APK will also fail to reach the API from that network.

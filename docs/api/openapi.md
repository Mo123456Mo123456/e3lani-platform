# API

Interactive OpenAPI UI: `http://localhost:4100/docs`

## Core REST

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/v1/auth/register` | no | Create account |
| POST | `/v1/auth/login` | no | Login |
| GET | `/v1/auth/me` | yes | Current user |
| GET | `/v1/planets` | no | List planets |
| GET | `/v1/planets/:id` | no | Planet summary + overlays |
| GET | `/v1/planets/:id/regions` | no | Regions |
| GET | `/v1/planets/:id/events` | no | Event log |
| GET | `/v1/planets/:id/timeline` | no | Timeline |
| POST | `/v1/contributions/analyze` | yes | AI structured parse + preview |
| POST | `/v1/contributions/apply` | yes | Persist contribution + simulate |
| GET | `/v1/me/impact` | yes | User impact stats |
| GET | `/v1/admin/overview` | admin | Admin metrics |

## WebSocket `/ws`

Client → `{ "type":"subscribe", "planetId":"..." }`
Server → `{ "type":"delta", "payload":{ events, regionPatches, tick } }`

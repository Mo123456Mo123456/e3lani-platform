# @planet/web — كوكب يولد أمامك

Next.js 15 App Router command-center UI for **Planet Born Before You**.

## Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS 3, Framer Motion
- Three.js + React Three Fiber / Drei (live procedural planet)
- TanStack Query, Zustand, Zod

## Setup

```bash
# from repo root
pnpm install
cp apps/web/.env.local.example apps/web/.env.local

# API must be running for live data
pnpm --filter @planet/api db:migrate
pnpm --filter @planet/api db:seed
pnpm --filter @planet/api dev   # :4000
pnpm --filter @planet/realtime dev  # :4001 optional WS

pnpm --filter @planet/web dev   # :3000
```

## Demo account

`explorer@planet.local` / `Explorer@123`

## Routes

| Path | Purpose |
|------|---------|
| `/` | Command center — 3D planet + event log + impact + timeline |
| `/explore` | Planet explorer with stats |
| `/civilizations` `/creatures` `/resources` `/technologies` `/alliances` | Entity lists |
| `/timeline` | Era scrubber + full event archive |
| `/contribute` | 12-step add-element wizard (AI analyze → inject → forecast) |
| `/causal/[eventId]` | Causal chain for an event |
| `/login` `/register` `/profile` | Auth + explorer profile |

## Env

- `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`)
- `NEXT_PUBLIC_WS_URL` (default `ws://localhost:4001/ws`)

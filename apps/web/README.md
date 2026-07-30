# Web frontend

Set `NEXT_PUBLIC_API_URL=http://localhost:3001`. HTTP requests always use
`credentials: "include"`; identity is restored from the server's httpOnly
session cookie through `/auth/me`.

The client connects to the authenticated WebSocket route at
`/ws?planetId=…`. A failed connection switches world and event queries to
30-second polling. No API failure activates synthetic data.

`NEXT_PUBLIC_SANDBOX_MODE=true` is the only switch that enables deterministic
browser-local world, identity, and contribution adapters. The UI labels this
mode. To expose server-backed sandbox registration without enabling browser
data, set `NEXT_PUBLIC_ALLOW_SANDBOX_REGISTRATION=true`.

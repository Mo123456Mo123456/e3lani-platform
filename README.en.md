# A Planet Born Before You | كوكب يولد أمامك

**Your world, your decision, an endless impact.**

A living web platform with a continuously evolving 3D planet. Each user adds one element; algorithmic simulation computes causal effects; AI only explains results grounded in simulation facts.

Arabic README: [README.md](./README.md)

## Quick start

```bash
cp .env.example .env
pnpm install
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
pnpm db:migrate && pnpm db:seed
pnpm dev:api    # :4000  — OpenAPI at /docs, WS at /ws
pnpm dev:web    # :3000
pnpm dev:admin  # :3001 (not linked from the public UI)
pnpm dev:ai     # :8002
pnpm dev:sim    # :8001
```

## Sandbox accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@planet-born.local` | `PlanetAdmin!2026` |
| Explorer | `explorer@planet-born.local` | `Explorer!2026` |

Without AI API keys, the explicit `sandbox` provider is used.

## Architecture docs

- [docs/architecture.md](./docs/architecture.md)
- [docs/simulation-engine.md](./docs/simulation-engine.md)
- [docs/ai-integration.md](./docs/ai-integration.md)
- [docs/database.md](./docs/database.md)
- [docs/deployment.md](./docs/deployment.md)

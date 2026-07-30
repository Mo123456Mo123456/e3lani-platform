# Architecture / المعمارية

The platform is split into apps, services, and reusable packages.

- `apps/web`: public experience. It renders world data and contribution workflows but does not run simulation logic.
- `apps/admin`: protected operations surface. It is intentionally not linked from public navigation.
- `services/api`: REST boundary with auth, contribution workflow, planet/event/timeline reads, and Swagger.
- `services/simulation-engine`: deterministic event-sourced core.
- `services/world-generator`: seed-based planet generation.
- `services/ai-orchestrator`: provider abstraction and narrative guardrails. Mock always works.
- `services/realtime-gateway`: broadcasts `world.event`, `contribution.status`, and `simulation.tick` delta topics.

Data contracts live in `packages/shared-types` as Zod schemas and TypeScript types.

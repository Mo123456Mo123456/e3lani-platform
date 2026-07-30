# Simulation Engine

The engine uses yearly ticks by default. State contains entity maps for species, resources, civilizations, cities, technologies, events, and causal links.

Core guarantees:

1. deterministic random streams through `SeededRandom`;
2. every world event has a cause;
3. snapshots can be taken and rolled back;
4. replaying an event log over the same seed restores state;
5. population updates respect carrying capacity.

Run:

```bash
pnpm --filter @kawkab/simulation-engine simulate
```

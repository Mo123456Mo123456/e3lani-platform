# Simulation Engine

The engine uses yearly ticks by default. State contains entity maps for species, resources, civilizations, cities, technologies, events, and causal links.

Core guarantees:

1. deterministic random streams through `SeededRandom`;
2. every world event has a cause;
3. snapshots can be taken and rolled back;
4. replaying an event log over the same seed restores state;
5. population updates respect carrying capacity.

Current modules:

- climate mutates region temperature, moisture, and pollution;
- plants spread, increase capacity, and can reduce pollution;
- ecosystem updates species populations deterministically;
- civilizations can found in multiple eligible regions and grow cities/economies;
- migration uses Dijkstra paths between regions;
- wars can start when pressure scores are high enough;
- `applyContribution` emits `CONTRIBUTION_APPLIED` plus category-specific caused follow-on events;
- `runFutureScenarios` forks deterministic subseeds for Monte Carlo previews;
- `serializeState` / `deserializeState` keep state persistence-friendly.

Run:

```bash
pnpm --filter @kawkab/simulation-engine simulate
```

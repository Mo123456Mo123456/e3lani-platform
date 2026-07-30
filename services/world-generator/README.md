# world-generator

**Status: implemented as a shared library — not a separate service.**

Procedural planet generation (seeded simplex/Worley terrain, biomes, rivers,
resources) lives in
[`packages/simulation-models/src/worldgen`](../../packages/simulation-models/src/worldgen)
because two consumers need bit-identical output:

1. the API's simulation engine (`WorldManager.createPlanet`)
2. the web client, which regenerates the same grid locally from the seed
   inside a Web Worker (`apps/web/src/components/planet/grid.worker.ts`)

Extracting a standalone generation service becomes interesting when planets
are generated on demand at higher resolution; the current grid sizes make an
extra network hop unnecessary. Not activated as a separate deployable.

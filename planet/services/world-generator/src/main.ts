import Fastify from "fastify";
import { createWorld, runTicks, worldChecksum } from "@planet/simulation-models";

const PORT = Number(process.env["PORT"] ?? 4300);
const ENGINE_URL = process.env["ENGINE_URL"] ?? "http://localhost:4100";
const API_URL = process.env["API_URL"] ?? "http://localhost:4000";
const INTERNAL_TOKEN = process.env["INTERNAL_TOKEN"] ?? "dev-internal-token";

/**
 * World Generator service: creates brand-new planets on demand.
 * The heavy compute happens here (generation + initial history), then the
 * world is registered with the simulation engine (live ticking) and the API
 * (persistence).
 */
const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

app.post<{ Body: { worldId: string; name?: string; seed?: number; historyTicks?: number } }>(
  "/generate",
  async (req, reply) => {
    const { worldId, name, historyTicks = 200 } = req.body ?? {};
    const seed = req.body?.seed ?? Math.floor(Math.random() * 1e9);
    if (!worldId) return reply.status(400).send({ error: "worldId_required" });

    const started = Date.now();
    const world = createWorld({
      worldId,
      name: name ?? worldId,
      seed,
      yearsPerTick: 1,
    });
    runTicks(world, historyTicks);

    // Register with the engine (live ticking authority).
    const engineRes = await fetch(`${ENGINE_URL}/worlds`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ worldId, name: world.name, seed, yearsPerTick: 1 }),
    });
    if (!engineRes.ok) return reply.status(502).send({ error: "engine_registration_failed" });

    // Register with the API (persistence) when it exposes internal registration.
    let apiRegistered = false;
    try {
      const apiRes = await fetch(`${API_URL}/internal/planets/register`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-token": INTERNAL_TOKEN },
        body: JSON.stringify({
          id: worldId,
          name: world.name,
          seed,
          yearsPerTick: 1,
          gridWidth: world.grid.width,
          gridHeight: world.grid.height,
        }),
      });
      apiRegistered = apiRes.ok;
    } catch {
      apiRegistered = false;
    }

    return {
      worldId,
      seed,
      tick: world.tick,
      events: world.events.length,
      civs: world.civs.length,
      checksum: worldChecksum(world),
      durationMs: Date.now() - started,
      engineRegistered: true,
      apiRegistered,
    };
  },
);

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`world-generator listening on :${PORT}`);
});

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  process.env.SQLITE_PATH = `./data/api-test-${Date.now()}.sqlite`;
  process.env.SIMULATION_SEED = `api-flow-${Date.now()}`;
  const mod = await import("../src/server");
  app = mod.app;
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("contribution confirmation integration", () => {
  it("persists contribution events and notifications", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: `creator-${Date.now()}@kawkab.local`, password: "change-me-creator", displayName: "Creator" }
    });
    expect(register.statusCode).toBe(200);
    const auth = register.json();
    const planet = (await app.inject({ method: "GET", url: "/planets/demo" })).json();
    const regionId = planet.planet.regions.find((region: any) => region.biome !== "deep_ocean")?.id;

    const create = await app.inject({
      method: "POST",
      url: "/contributions",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { planetId: planet.planet.id, category: "plant", prompt: "نبات يضيء المدن ليلاً", locale: "ar", targetRegionId: regionId }
    });
    expect(create.statusCode).toBe(200);
    const contributionId = create.json().contribution.id;

    const preview = await app.inject({ method: "GET", url: `/contributions/${contributionId}/preview`, headers: { authorization: `Bearer ${auth.accessToken}` } });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().successProbability).toBeGreaterThan(0);

    const confirm = await app.inject({ method: "POST", url: `/contributions/${contributionId}/confirm`, headers: { authorization: `Bearer ${auth.accessToken}` } });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().events.some((event: any) => event.type === "CONTRIBUTION_APPLIED")).toBe(true);

    const notifications = await app.inject({ method: "GET", url: "/notifications", headers: { authorization: `Bearer ${auth.accessToken}` } });
    expect(notifications.statusCode).toBe(200);
    expect(notifications.json().notifications.length).toBeGreaterThan(0);
  }, 30_000);
});

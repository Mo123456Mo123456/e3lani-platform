import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ContributionCategory } from "@planet/shared-types";
import { buildServer } from "./main.js";

let app: ReturnType<typeof buildServer>;
const WORLD = "test-http-world";

beforeAll(async () => {
  // Small world keeps HTTP tests fast; production defaults live in config.
  process.env["ENGINE_PLANT_SPECIES"] = "150";
  process.env["ENGINE_ANIMAL_SPECIES"] = "60";
  process.env["ENGINE_CIVILIZATIONS"] = "6";
  app = buildServer();
  await app.ready();
  const res = await app.inject({
    method: "POST",
    url: "/worlds",
    payload: { worldId: WORLD, name: "HTTP Test", seed: 777, yearsPerTick: 1 },
  });
  expect(res.statusCode).toBe(200);
});

afterAll(async () => {
  await app.close();
});

describe("simulation-engine HTTP API", () => {
  it("serves world meta and grid", async () => {
    const meta = await app.inject({ method: "GET", url: `/worlds/${WORLD}` });
    expect(meta.statusCode).toBe(200);
    const body = meta.json();
    expect(body.stats.civs).toBeGreaterThan(0);

    const grid = await app.inject({ method: "GET", url: `/worlds/${WORLD}/grid` });
    expect(grid.statusCode).toBe(200);
    const g = grid.json();
    expect(g.elevation.length).toBe(g.width * g.height);
    expect(g.biome.length).toBe(g.width * g.height);
  });

  it("advances ticks and returns real events", async () => {
    const res = await app.inject({ method: "POST", url: `/worlds/${WORLD}/ticks`, payload: { count: 30 } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tick).toBe(30);
    expect(body.eventCount).toBeGreaterThan(0);

    const events = await app.inject({ method: "GET", url: `/worlds/${WORLD}/events?limit=20` });
    expect(events.json().events.length).toBeGreaterThan(0);
  });

  it("applies a validated contribution and rejects invalid ones", async () => {
    const analysis = {
      category: ContributionCategory.Plant,
      name: "Skyroot",
      summary: "tall glowing tree",
      traits: {
        size: 0.8, growthRate: 0.4, waterNeed: 0.6, energyOutput: 0,
        pollutionAbsorption: 0.7, pollutionEmission: 0, coldResistance: 0.5,
        heatResistance: 0.6, aggression: 0, intelligence: 0, reproductionRate: 0.5,
        lifespan: 0.8, adaptability: 0.7, rarity: 0.6, nightLuminosity: 0.9,
        toxicity: 0, spreadRate: 0.5,
      },
      possibleBiomes: ["temperate_forest"],
      risks: [],
      benefits: [],
      sandbox: true,
    };
    // Find a land cell from the grid.
    const grid = (await app.inject({ method: "GET", url: `/worlds/${WORLD}/grid` })).json();
    let land = 0;
    for (let i = 0; i < grid.elevation.length; i++) {
      if (grid.elevation[i] / 1000 > grid.seaLevel + 0.02) {
        land = i;
        break;
      }
    }
    const ok = await app.inject({
      method: "POST",
      url: `/worlds/${WORLD}/contributions`,
      payload: { contributionId: "http-c1", analysis, cellIndex: land, runTicks: 10 },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().applied).toBe(true);
    expect(ok.json().contributionEvents.length).toBeGreaterThanOrEqual(2);

    const bad = await app.inject({
      method: "POST",
      url: `/worlds/${WORLD}/contributions`,
      payload: { contributionId: "http-c2", analysis: { category: "plant" }, cellIndex: land },
    });
    expect(bad.statusCode).toBe(422);
  });

  it("previews futures without mutating the world", async () => {
    const before = (await app.inject({ method: "GET", url: `/worlds/${WORLD}` })).json();
    const analysis = {
      category: ContributionCategory.Resource,
      name: "Storm Crystal",
      summary: "energy-rich crystal",
      traits: {
        size: 0.5, growthRate: 0.1, waterNeed: 0.1, energyOutput: 0.9,
        pollutionAbsorption: 0, pollutionEmission: 0.2, coldResistance: 0.9,
        heatResistance: 0.9, aggression: 0, intelligence: 0, reproductionRate: 0.05,
        lifespan: 1, adaptability: 0.3, rarity: 0.9, nightLuminosity: 0.4,
        toxicity: 0.2, spreadRate: 0.1,
      },
      possibleBiomes: ["mountains"],
      risks: ["resource_conflict"],
      benefits: ["energy"],
      sandbox: true,
    };
    const res = await app.inject({
      method: "POST",
      url: `/worlds/${WORLD}/contributions/preview`,
      payload: { contributionId: "prev-1", analysis, cellIndex: 500, horizons: [10, 100], runs: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().horizons.length).toBe(2);
    const after = (await app.inject({ method: "GET", url: `/worlds/${WORLD}` })).json();
    expect(after.meta.tick).toBe(before.meta.tick);
  });

  it("rolls back to a snapshot", async () => {
    const res = await app.inject({ method: "POST", url: `/worlds/${WORLD}/rollback`, payload: { tick: 0 } });
    expect(res.statusCode).toBe(200);
    expect(res.json().meta.tick).toBe(0);
  });
});

import { expect } from "vitest";
import { loadApiEnv, type ApiEnv } from "@planet/config";
import { buildApp } from "../src/app.js";
import type { AppContext } from "../src/context.js";
import { MemoryRepository } from "../src/store/memory.js";
import { WorldManager } from "../src/world/manager.js";
import { seedSandboxAccounts } from "../src/world/bootstrap.js";
import type { FastifyInstance } from "fastify";

export interface TestHarness {
  app: FastifyInstance;
  ctx: AppContext;
  planetId: string;
}

export function testEnv(overrides: Partial<ApiEnv> = {}): ApiEnv {
  return loadApiEnv({
    NODE_ENV: "test",
    PORT: "0",
    JWT_SECRET: "test-secret-test-secret-test-secret",
    AUTO_TICK: "false",
    ...overrides,
  } as unknown as NodeJS.ProcessEnv);
}

export async function createHarness(): Promise<TestHarness> {
  const env = testEnv();
  const repository = new MemoryRepository();
  const worlds = new WorldManager({
    repository,
    yearsPerTick: 5,
    snapshotInterval: 10,
    engineConfig: {
      worldgen: { latBands: 24, lonBands: 48, resourceDensity: 0.08, riverCount: 10 },
      initialCivilizations: 5,
      initialSpecies: 30,
      initialPlants: 40,
      snapshotInterval: 10,
    },
  });
  const { app, ctx } = await buildApp({ env, repository, worlds });
  await seedSandboxAccounts(repository);
  const planet = await ctx.worlds.createPlanet("test-seed", "كوكب الاختبار");
  await app.ready();
  return { app, ctx, planetId: planet.id };
}

export async function registerUser(app: FastifyInstance, email = "user@test.dev") {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "password-123", displayName: "مستخدم الاختبار" },
  });
  expect(response.statusCode, response.body).toBe(201);
  const body = response.json() as { user: { id: string }; tokens: { accessToken: string; refreshToken: string } };
  return body;
}

export async function loginAdmin(app: FastifyInstance) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "admin@planet.local", password: "planet-admin-2026" },
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as { tokens: { accessToken: string } };
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./index.js";

let server: FastifyInstance | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("API operational boundaries", () => {
  it("reports database failure instead of presenting a fake healthy service", async () => {
    const existing = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    server = await buildServer();
    const response = await server.inject({ method: "GET", url: "/health" });
    if (existing) process.env.DATABASE_URL = existing;
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: "degraded", database: "unavailable" });
  });

  it("publishes generated OpenAPI documentation", async () => {
    server = await buildServer();
    const response = await server.inject({ method: "GET", url: "/docs/json" });
    expect(response.statusCode).toBe(200);
    expect(response.json().info.title).toContain("كوكب");
  });
});

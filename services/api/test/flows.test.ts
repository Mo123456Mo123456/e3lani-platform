import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("API authentication and contributions", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    process.env.AI_ORCHESTRATOR_URL = "http://127.0.0.1:1";
    app = await buildApp({ seed: true });
    await app.ready();
  }, 20_000);

  afterAll(async () => {
    await app.close();
  });

  it("registers, authenticates, and rotates refresh tokens", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "new-explorer@example.com",
        password: "StrongPassword!2026",
        displayName: "New Explorer",
        locale: "en",
      },
    });
    expect(register.statusCode).toBe(201);
    ({ accessToken, refreshToken } = register.json());

    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe("new-explorer@example.com");

    const rotated = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(rotated.statusCode).toBe(200);
    accessToken = rotated.json().accessToken;

    const reused = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(reused.statusCode).toBe(401);
  });

  it("analyzes, confirms, and lists a contribution", async () => {
    const planets = await app.inject({ method: "GET", url: "/planets" });
    const planetId = planets.json()[0].id as string;

    const analyzed = await app.inject({
      method: "POST",
      url: "/contributions/analyze",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        idea: "A blue tree that filters pollution",
        category: "plant",
        locale: "en",
      },
    });
    expect(analyzed.statusCode).toBe(200);
    expect(analyzed.json().source).toBe("local-fallback");

    const confirmed = await app.inject({
      method: "POST",
      url: "/contributions/confirm",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        planetId,
        structured: analyzed.json().structured,
        location: { lat: 10, lon: 20 },
        runPreviewYears: 1,
      },
    });
    expect(confirmed.statusCode).toBe(201);
    expect(confirmed.json().previewEvents.length).toBeGreaterThan(0);

    const mine = await app.inject({
      method: "GET",
      url: "/contributions/mine",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(mine.statusCode).toBe(200);
    expect(mine.json()).toHaveLength(1);
  }, 20_000);
});

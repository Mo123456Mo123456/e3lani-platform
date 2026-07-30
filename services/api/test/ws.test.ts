import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { RealtimeMessage } from "@planet/shared-types";
import { createHarness, loginAdmin, type TestHarness } from "./helpers";

let h: TestHarness;
beforeAll(async () => {
  h = await createHarness();
  await h.app.listen({ port: 0, host: "127.0.0.1" });
});
afterAll(async () => {
  await h.app.close();
});

function address(): string {
  const addr = h.app.server.address();
  if (addr && typeof addr === "object") return `127.0.0.1:${addr.port}`;
  throw new Error("no server address");
}

describe("realtime gateway", () => {
  it("streams hello, ticks, events and deltas over WebSocket", async () => {
    const admin = await loginAdmin(h.app);
    const messages: RealtimeMessage[] = [];
    const ws = new WebSocket(`ws://${address()}/planets/${h.planetId}/stream?token=${admin.tokens.accessToken}`);
    ws.on("message", (raw) => {
      messages.push(JSON.parse(String(raw)) as RealtimeMessage);
    });
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", reject);
    });

    // wait for hello
    await new Promise((r) => setTimeout(r, 150));
    expect(messages.some((m) => m.kind === "hello")).toBe(true);

    // advance the world — the stream must carry ticks/events/deltas
    await h.ctx.worlds.advance(h.planetId, 3);
    await new Promise((r) => setTimeout(r, 100));
    expect(messages.some((m) => m.kind === "tick")).toBe(true);
    expect(messages.some((m) => m.kind === "events")).toBe(true);
    expect(messages.some((m) => m.kind === "delta")).toBe(true);
    ws.close();
  });

  it("rejects invalid tokens", async () => {
    const ws = new WebSocket(`ws://${address()}/planets/${h.planetId}/stream?token=bad-token`);
    const code = await new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
    });
    expect(code).toBe(4401);
  });

  it("allows anonymous world watching without user notifications", async () => {
    const ws = new WebSocket(`ws://${address()}/planets/${h.planetId}/stream`);
    const messages: RealtimeMessage[] = [];
    ws.on("message", (raw) => messages.push(JSON.parse(String(raw)) as RealtimeMessage));
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", reject);
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(messages.some((m) => m.kind === "hello")).toBe(true);
    ws.close();
  });
});

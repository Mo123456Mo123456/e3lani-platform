import { describe, expect, it } from "vitest";
import { parseClientMessage, parseDeltaMessage } from "../src/messages.js";

describe("message parsing", () => {
  it("accepts subscribe messages with a planet id", () => {
    expect(parseClientMessage(JSON.stringify({ type: "subscribe", planetId: " planet-alpha " }))).toEqual({
      type: "subscribe",
      planetId: "planet-alpha",
    });
  });

  it("rejects unknown client message types", () => {
    expect(() => parseClientMessage(JSON.stringify({ type: "state", planetId: "planet-alpha" }))).toThrow(
      "Unsupported message type",
    );
  });

  it("accepts delta messages and fills timestamps", () => {
    const delta = parseDeltaMessage(
      JSON.stringify({
        type: "tick",
        planetId: "planet-alpha",
        tick: 12,
        payload: { changed: ["climate"] },
      }),
    );

    expect(delta).toMatchObject({
      type: "tick",
      planetId: "planet-alpha",
      tick: 12,
      payload: { changed: ["climate"] },
    });
    expect(delta.ts).toEqual(expect.any(String));
  });

  it("rejects deltas without payloads", () => {
    expect(() => parseDeltaMessage(JSON.stringify({ type: "tick", planetId: "planet-alpha" }))).toThrow(
      "Delta payload is required",
    );
  });
});

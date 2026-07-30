export interface SubscribeMessage {
  type: "subscribe";
  planetId: string;
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  planetId: string;
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage;

export interface RealtimeDelta {
  type: string;
  planetId: string;
  tick?: number;
  payload: Record<string, unknown>;
  ts: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseClientMessage(raw: string | Buffer | ArrayBuffer | Buffer[]): ClientMessage {
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : Array.isArray(raw) ? Buffer.concat(raw).toString("utf8") : String(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Message must be valid JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("Message must be a JSON object");
  }

  if (parsed.type !== "subscribe" && parsed.type !== "unsubscribe") {
    throw new Error("Unsupported message type");
  }

  if (typeof parsed.planetId !== "string" || parsed.planetId.trim().length === 0) {
    throw new Error("planetId is required");
  }

  return {
    type: parsed.type,
    planetId: parsed.planetId.trim(),
  };
}

export function parseDeltaMessage(raw: string): RealtimeDelta {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Delta must be valid JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("Delta must be a JSON object");
  }

  if (typeof parsed.planetId !== "string" || parsed.planetId.trim().length === 0) {
    throw new Error("Delta planetId is required");
  }

  if (typeof parsed.type !== "string" || parsed.type.trim().length === 0) {
    throw new Error("Delta type is required");
  }

  if (!isRecord(parsed.payload)) {
    throw new Error("Delta payload is required");
  }

  if (parsed.tick !== undefined && typeof parsed.tick !== "number") {
    throw new Error("Delta tick must be a number");
  }

  return {
    type: parsed.type,
    planetId: parsed.planetId.trim(),
    tick: parsed.tick,
    payload: parsed.payload,
    ts: typeof parsed.ts === "string" ? parsed.ts : new Date().toISOString(),
  };
}

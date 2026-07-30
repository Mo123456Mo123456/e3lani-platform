import { Injectable } from "@nestjs/common";
import { config } from "../config.js";

/**
 * Thin typed client for the simulation-engine service. The engine owns live
 * world state; the API persists everything the engine emits.
 */
@Injectable()
export class EngineClient {
  private base = config.engineUrl;

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = new Error((data["error"] as string) ?? `engine_http_${res.status}`);
      (err as { status?: number }).status = res.status;
      throw err;
    }
    return data as T;
  }

  ensureWorld(input: { worldId: string; name: string; seed: number; yearsPerTick: number }) {
    return this.call<{ meta: { tick: number } }>("POST", "/worlds", input);
  }

  runTicks(worldId: string, count: number) {
    return this.call<{ tick: number; year: number; eventCount: number; events: unknown[] }>(
      "POST",
      `/worlds/${worldId}/ticks`,
      { count },
    );
  }

  applyContribution(worldId: string, input: { contributionId: string; analysis: unknown; cellIndex: number; runTicks?: number }) {
    return this.call<{
      applied: boolean;
      rootEvent: unknown;
      entityId?: number;
      tick: number;
      contributionEvents: unknown[];
      newEvents: unknown[];
    }>("POST", `/worlds/${worldId}/contributions`, input);
  }

  previewContribution(worldId: string, input: { contributionId: string; analysis: unknown; cellIndex: number }) {
    return this.call<unknown>("POST", `/worlds/${worldId}/contributions/preview`, input);
  }

  snapshot(worldId: string) {
    return this.call<Record<string, unknown>>("GET", `/worlds/${worldId}/snapshot`);
  }

  grid(worldId: string) {
    return this.call<Record<string, unknown>>("GET", `/worlds/${worldId}/grid`);
  }

  region(worldId: string, cell: number) {
    return this.call<Record<string, unknown>>("GET", `/worlds/${worldId}/regions/${cell}`);
  }

  events(worldId: string, beforeSeq?: number, limit = 50) {
    const q = new URLSearchParams({ limit: String(limit) });
    if (beforeSeq !== undefined) q.set("beforeSeq", String(beforeSeq));
    return this.call<{ events: unknown[]; nextCursor: number | null }>("GET", `/worlds/${worldId}/events?${q}`);
  }

  rollback(worldId: string, tick: number) {
    return this.call<unknown>("POST", `/worlds/${worldId}/rollback`, { tick });
  }

  async healthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

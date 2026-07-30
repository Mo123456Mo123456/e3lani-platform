import { Injectable, ServiceUnavailableException } from "@nestjs/common";

export type EngineState = Record<string, unknown> & {
  meta: { seed: number; tick: number; yearsPerTick: number; globalTempShift: number; co2: number };
  grid: { latBands: number; lonBands: number };
  cells: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
};

export interface EngineEvent {
  id: string;
  tick: number;
  type: string;
  importance: number;
  cellId: number | null;
  civIds: string[];
  speciesIds: string[];
  plantIds: string[];
  causeEventId: string | null;
  contributionId: string | null;
  confidence: number;
  payload: Record<string, unknown>;
}

/** Thin HTTP client for the deterministic simulation engine. */
@Injectable()
export class EngineClient {
  private baseUrl(): string {
    return process.env.SIMULATION_ENGINE_URL ?? "http://localhost:8001";
  }

  private async call<T>(path: string, body: unknown, timeoutMs = 120_000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl()}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ServiceUnavailableException({
          error: "engine_error",
          status: res.status,
          detail: detail.slice(0, 500),
        });
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException({
        error: "engine_unreachable",
        detail: (err as Error).message,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  generate(seed: number, params?: Record<string, unknown>) {
    return this.call<{ state: EngineState; events: EngineEvent[]; hash: string; summary: Record<string, unknown> }>(
      "/generate",
      { seed, params },
    );
  }

  advance(state: EngineState, ticks: number) {
    return this.call<{ state: EngineState; events: EngineEvent[]; hash: string }>(
      "/advance",
      { state, ticks },
      Math.max(120_000, ticks * 3000),
    );
  }

  inject(state: EngineState, contribution: Record<string, unknown>) {
    return this.call<{
      state: EngineState;
      events: EngineEvent[];
      contributionId: string;
      assessment: Record<string, unknown> | null;
      hash: string;
    }>("/inject", { state, contribution, assess: false });
  }

  assess(state: EngineState, contribution: Record<string, unknown>) {
    return this.call<{ assessment: Record<string, unknown> }>("/assess", { state, contribution }, 60_000);
  }

  scenarios(
    state: EngineState,
    contribution: Record<string, unknown> | null,
    horizons?: number[],
    runs?: number,
  ) {
    return this.call<{ report: Record<string, unknown> }>(
      "/scenarios",
      { state, contribution, horizons, runs },
      600_000,
    );
  }

  maps(state: EngineState, layers?: string[], scale = 4) {
    return this.call<{ layers: Record<string, string>; tick: number }>(
      "/maps",
      { state, layers, scale },
      120_000,
    );
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl()}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PythonHttpService } from "./python-http.service";

@Injectable()
export class SimulationEngineService {
  constructor(
    private readonly config: ConfigService,
    private readonly http: PythonHttpService,
  ) {}

  private get baseUrl(): string {
    return this.config.getOrThrow<string>("simulationUrl");
  }

  async health(): Promise<Record<string, unknown>> {
    return this.http.get(this.baseUrl, "/health", "Simulation engine", {
      timeoutMs: 3000,
    });
  }

  async generateWorld(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post(this.baseUrl, "/world/generate", input, "Simulation engine", {
      timeoutMs: 20000,
    });
  }

  async ensureWorld(input: {
    seed: string;
    planetId?: string;
    resolution?: [number, number];
  }): Promise<Record<string, unknown>> {
    return this.http.post(
      this.baseUrl,
      "/world/ensure",
      {
        seed: input.seed,
        planet_id: input.planetId,
        resolution: input.resolution,
      },
      "Simulation engine",
      { timeoutMs: 30000 },
    );
  }

  async tick(input: {
    planetId: string;
    seed?: string;
    steps?: number;
    ticks?: number;
    unit?: string;
  }): Promise<Record<string, unknown>> {
    return this.http.post(
      this.baseUrl,
      "/simulate/tick",
      {
        planet_id: input.planetId,
        seed: input.seed,
        ticks: input.ticks ?? input.steps ?? 1,
        steps: input.steps,
        unit: input.unit ?? "year",
      },
      "Simulation engine",
      { timeoutMs: 20000 },
    );
  }

  async forecast(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body = {
      planet_id: input.planetId ?? input.planet_id,
      seed: input.seed,
      contribution_id: input.contributionId ?? input.contribution_id,
      horizons: input.horizons,
      region_id: input.regionId ?? input.region_id,
      element: input.element,
      mode: input.mode,
    };
    return this.http.post(this.baseUrl, "/forecast", body, "Simulation engine", {
      timeoutMs: 12000,
    });
  }

  async applyContribution(input: {
    planetId: string;
    seed: string;
    userId: string;
    regionId?: string;
    lat?: number;
    lon?: number;
    gridX?: number;
    gridY?: number;
    element: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    return this.http.post(
      this.baseUrl,
      "/contribute/apply",
      {
        planet_id: input.planetId,
        seed: input.seed,
        user_id: input.userId,
        region_id: input.regionId,
        lat: input.lat,
        lon: input.lon,
        gridX: input.gridX,
        gridY: input.gridY,
        contribution: input.element,
        element: input.element,
      },
      "Simulation engine",
      { timeoutMs: 20000 },
    );
  }

  async rollback(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post(
      this.baseUrl,
      "/rollback",
      {
        planet_id: input.planetId ?? input.planet_id,
        snapshot_id: input.snapshotId ?? input.snapshot_id,
        targetTick: input.targetTick,
        reason: input.reason,
      },
      "Simulation engine",
      { timeoutMs: 20000 },
    );
  }
}

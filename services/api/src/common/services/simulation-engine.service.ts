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

  async tick(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post(this.baseUrl, "/simulate/tick", input, "Simulation engine", {
      timeoutMs: 20000,
    });
  }

  async forecast(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post(this.baseUrl, "/forecast", input, "Simulation engine", {
      timeoutMs: 12000,
    });
  }

  async applyContribution(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post(this.baseUrl, "/contribute/apply", input, "Simulation engine", {
      timeoutMs: 20000,
    });
  }

  async rollback(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post(this.baseUrl, "/rollback", input, "Simulation engine", {
      timeoutMs: 20000,
    });
  }
}

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PythonHttpService } from "./python-http.service";

export interface ModerationResponse {
  allowed: boolean;
  labels?: string[];
  reason?: string;
  [key: string]: unknown;
}

export interface AnalyzeContributionResponse {
  element?: Record<string, unknown>;
  suggestions?: string[];
  [key: string]: unknown;
}

@Injectable()
export class AiOrchestratorService {
  constructor(
    private readonly config: ConfigService,
    private readonly http: PythonHttpService,
  ) {}

  private get baseUrl(): string {
    return this.config.getOrThrow<string>("aiOrchestratorUrl");
  }

  async health(): Promise<Record<string, unknown>> {
    return this.http.get(this.baseUrl, "/health", "AI orchestrator", {
      timeoutMs: 3000,
    });
  }

  async moderate(input: { text: string; locale?: string }): Promise<ModerationResponse> {
    return this.http.post(this.baseUrl, "/moderate", input, "AI orchestrator");
  }

  async analyzeContribution(input: {
    text: string;
    categoryHint?: string;
    locale?: string;
  }): Promise<AnalyzeContributionResponse> {
    return this.http.post(
      this.baseUrl,
      "/analyze-contribution",
      input,
      "AI orchestrator",
      { timeoutMs: 15000 },
    );
  }

  async parse(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post(this.baseUrl, "/parse", input, "AI orchestrator");
  }

  async balance(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post(this.baseUrl, "/balance", input, "AI orchestrator");
  }

  async narrate(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post(this.baseUrl, "/narrate", input, "AI orchestrator");
  }
}

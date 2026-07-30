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
    const raw = await this.http.post<Record<string, unknown>>(
      this.baseUrl,
      "/moderate",
      input,
      "AI orchestrator",
    );
    const nested = raw.moderation;
    if (nested && typeof nested === "object") {
      const mod = nested as Record<string, unknown>;
      return {
        allowed: Boolean(mod.allowed),
        labels: Array.isArray(mod.flags)
          ? (mod.flags as string[])
          : Array.isArray(mod.labels)
            ? (mod.labels as string[])
            : [],
        reason: Array.isArray(mod.reasons)
          ? (mod.reasons as string[]).join("; ")
          : typeof mod.reason === "string"
            ? mod.reason
            : undefined,
        ...mod,
      };
    }
    return raw as ModerationResponse;
  }

  async analyzeContribution(input: {
    text: string;
    categoryHint?: string;
    locale?: string;
  }): Promise<AnalyzeContributionResponse> {
    const raw = await this.http.post<Record<string, unknown>>(
      this.baseUrl,
      "/analyze-contribution",
      {
        text: input.text,
        locale: input.locale,
        category_hint: input.categoryHint,
      },
      "AI orchestrator",
      { timeoutMs: 15000 },
    );

    // Normalize AI response for web/API consumers
    const balanced = (raw.balanced ?? raw.element) as Record<string, unknown> | undefined;
    const moderationRaw = raw.moderation as Record<string, unknown> | undefined;
    return {
      ...raw,
      element: balanced,
      suggestions: Array.isArray(raw.balance_notes)
        ? (raw.balance_notes as string[])
        : undefined,
      moderation: moderationRaw
        ? {
            allowed: Boolean(moderationRaw.allowed),
            labels: (moderationRaw.flags as string[]) ?? [],
            reason: Array.isArray(moderationRaw.reasons)
              ? (moderationRaw.reasons as string[]).join("; ")
              : undefined,
          }
        : undefined,
      sandbox: Boolean(raw.sandbox),
      provider: typeof raw.provider === "string" ? raw.provider : "sandbox",
    };
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

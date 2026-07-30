/**
 * AI orchestration boundary.
 *
 * Resolution order:
 *   1. External orchestrator (services/ai-orchestrator, FastAPI) when
 *      AI_ORCHESTRATOR_URL is configured — real LLM providers live there.
 *   2. Built-in deterministic sandbox analyzer (provider "mock").
 *
 * Every call is logged to the AIRequest table with provider, latency and a
 * cost estimate (0 for the sandbox) for the admin cost monitor.
 */
import { randomUUID } from "node:crypto";
import type {
  AIRequestLog,
  ContributionCategory,
  Locale,
  StructuredContribution,
} from "@planet/shared-types";
import { structuredContributionSchema } from "@planet/validation";
import { analyzeText } from "./analyzer.js";
import type { Repository } from "../store/repository.js";

export interface OrchestratorConfig {
  url: string;
  provider: "mock" | "openai" | "anthropic" | "gemini";
}

export class AiOrchestrator {
  constructor(
    private readonly config: OrchestratorConfig,
    private readonly repository: Repository,
  ) {}

  get isSandbox(): boolean {
    return this.config.url === "";
  }

  async parseContribution(
    text: string,
    category: ContributionCategory | undefined,
    locale: Locale,
    userId: string,
  ): Promise<{ structured: StructuredContribution; provider: string }> {
    const started = Date.now();
    if (this.isSandbox) {
      const result = analyzeText(text, category, locale);
      await this.log("parse", "mock", started, true);
      return result;
    }
    try {
      const response = await fetch(`${this.config.url}/v1/parse-contribution`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, category, locale, user_id: userId }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`orchestrator ${response.status}`);
      const payload = (await response.json()) as { structured: unknown; provider: string };
      const structured = structuredContributionSchema.parse(payload.structured);
      await this.log("parse", payload.provider ?? this.config.provider, started, true);
      return { structured, provider: payload.provider ?? this.config.provider };
    } catch (error) {
      await this.log("parse", this.config.provider, started, false);
      // graceful degradation: the sandbox path stays available
      const result = analyzeText(text, category, locale);
      return { ...result, provider: "mock" };
    }
  }

  private async log(kind: AIRequestLog["kind"], provider: string, started: number, success: boolean): Promise<void> {
    const latencyMs = Date.now() - started;
    await this.repository.saveAIRequest({
      id: randomUUID(),
      provider,
      kind,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: provider === "mock" ? 0 : estimateCost(provider, latencyMs),
      latencyMs,
      success,
      createdAt: new Date().toISOString(),
    });
  }
}

function estimateCost(provider: string, latencyMs: number): number {
  const perSecond: Record<string, number> = {
    openai: 0.0004,
    anthropic: 0.0005,
    gemini: 0.0002,
  };
  return Math.round((perSecond[provider] ?? 0.0003) * (latencyMs / 1000) * 1e6) / 1e6;
}

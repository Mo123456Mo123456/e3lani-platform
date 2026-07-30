import type { AnalyzedContribution } from "@planet/shared-types";
import { analyzedContributionSchema } from "@planet/validation";
import { MockProvider } from "./providers/mock.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GeminiProvider } from "./providers/gemini.js";
import { ProviderUnavailableError, type AnalyzeRequest, type LLMProvider, type NarrateRequest, type NarrateResult } from "./providers/base.js";

export interface ProviderStatus {
  name: string;
  live: boolean;
  sandbox: boolean;
}

/**
 * Provider registry + selection. The first *live* provider in
 * AI_PROVIDER_PRIORITY wins; when no keys exist, the mock provider serves
 * sandbox results that are explicitly flagged — never silently fake.
 */
export class Orchestrator {
  private providers: LLMProvider[];
  private mock = new MockProvider();

  constructor() {
    this.providers = [new OpenAIProvider(), new AnthropicProvider(), new GeminiProvider()];
  }

  statuses(): ProviderStatus[] {
    return [
      ...this.providers.map((p) => ({ name: p.name, live: p.isLive(), sandbox: false })),
      { name: this.mock.name, live: true, sandbox: true },
    ];
  }

  activeProviderName(): string {
    return this.providers.find((p) => p.isLive())?.name ?? this.mock.name;
  }

  async analyze(req: AnalyzeRequest): Promise<AnalyzedContribution> {
    const live = this.providers.find((p) => p.isLive());
    if (!live) return this.mock.analyze(req);
    try {
      const result = await live.analyze(req);
      // Structured output is validated before it touches anything downstream.
      const parsed = analyzedContributionSchema.safeParse(result);
      if (!parsed.success) {
        // A live provider returned garbage: fall back to sandbox rather than
        // passing unvalidated data through.
        return this.mock.analyze(req);
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof ProviderUnavailableError) return this.mock.analyze(req);
      throw err;
    }
  }

  async narrate(req: NarrateRequest): Promise<NarrateResult> {
    const live = this.providers.find((p) => p.isLive());
    if (!live) return this.mock.narrate(req);
    try {
      const result = await live.narrate(req);
      return { ...result, text: enforceGrounding(result.text, req) };
    } catch {
      return this.mock.narrate(req);
    }
  }
}

/**
 * Grounding guard: the narrative may not cite years or percentages that do
 * not appear in the simulation facts. Violating sentences are stripped —
 * the LLM explains the simulation, it never invents it.
 */
export function enforceGrounding(text: string, req: NarrateRequest): string {
  const allowedYears = new Set(req.facts.map((f) => String(Math.round(f.year))));
  const sentences = text.split(/(?<=[.!؟?])\s+/);
  const kept: string[] = [];
  for (const sentence of sentences) {
    const years = sentence.match(/\b\d{1,6}\b/g) ?? [];
    const bad = years.some((y) => {
      if (y.length <= 2) return false; // percentages and small numbers are fine
      return !allowedYears.has(y);
    });
    if (!bad) kept.push(sentence);
  }
  return kept.join(" ").trim() || text.slice(0, 0);
}

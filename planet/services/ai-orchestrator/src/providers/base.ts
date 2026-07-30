import type { AnalyzedContribution } from "@planet/shared-types";
import { ContributionCategory } from "@planet/shared-types";

/**
 * Provider adapter contract. Every LLM backend (OpenAI, Anthropic, Gemini,
 * local mock) implements the same two operations so the platform is never
 * bound to a single vendor. All outputs are validated against
 * `analyzedContributionSchema` by the caller before use.
 */
export interface AnalyzeRequest {
  category: ContributionCategory;
  text: string;
  locale: "ar" | "en";
}

export interface NarrateRequest {
  locale: "ar" | "en";
  /** Ground-truth simulation facts. The narrative must only use these. */
  facts: NarrativeFact[];
}

export interface NarrativeFact {
  type: string;
  year: number;
  cellIndex?: number;
  numbers?: Record<string, number>;
  names?: Record<string, string>;
}

export interface NarrateResult {
  text: string;
  /** True when produced by a real LLM; false for template/mock output. */
  llmGenerated: boolean;
}

export interface LLMProvider {
  name: string;
  /** Whether this provider has live credentials configured. */
  isLive(): boolean;
  analyze(req: AnalyzeRequest): Promise<AnalyzedContribution>;
  narrate(req: NarrateRequest): Promise<NarrateResult>;
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string) {
    super(`provider_not_configured:${provider}`);
  }
}

import type { ContributionCategory, Locale, NarrationFact, WorldEvent } from "@kawkab/shared-types";

export type AiOperation = "parse_contribution" | "narrate" | "moderate" | "scenario_summary";

export interface AiUsage {
  provider: string;
  model: string;
  operation: AiOperation;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  sandbox: boolean;
}

export interface JsonCompletionRequest {
  operation: AiOperation;
  system: string;
  prompt: string;
  locale: Locale;
  maxTokens?: number;
}

export interface JsonCompletionResult {
  raw: string;
  json: unknown;
  usage: AiUsage;
}

export interface TextCompletionResult {
  text: string;
  usage: AiUsage;
}

/** Provider adapter contract — the platform never binds to a single vendor. */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  /** true when this is the deterministic offline sandbox */
  readonly sandbox: boolean;
  completeJson(req: JsonCompletionRequest): Promise<JsonCompletionResult>;
  completeText(req: JsonCompletionRequest): Promise<TextCompletionResult>;
}

export interface ParseContributionInput {
  text: string;
  category?: ContributionCategory;
  locale: Locale;
}

export interface NarrationInput {
  events: WorldEvent[];
  facts: NarrationFact[];
  locale: Locale;
  style?: "chronicle" | "report";
}

export interface ModerationOutput {
  status: "approved" | "rejected" | "flagged";
  score: number;
  reasons: string[];
}

/** rough per-token USD costs (input/output), used for the cost dashboard */
export const MODEL_COSTS: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15 / 1e6, out: 0.6 / 1e6 },
  "claude-3-5-haiku-latest": { in: 0.8 / 1e6, out: 4 / 1e6 },
  "gemini-1.5-flash": { in: 0.075 / 1e6, out: 0.3 / 1e6 },
  mock: { in: 0, out: 0 },
};

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const c = MODEL_COSTS[model] ?? { in: 1 / 1e6, out: 3 / 1e6 };
  return tokensIn * c.in + tokensOut * c.out;
}

export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

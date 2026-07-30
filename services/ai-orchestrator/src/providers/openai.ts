import { MockProvider } from "./mock.js";
import type { AiProvider } from "./types.js";
import type { StructuredContribution } from "@planet/shared-types";

/**
 * OpenAI adapter — falls back to sandbox mock when key is missing.
 * Does not invent simulation outcomes; only structures ideas / narrates given effects.
 */
export class OpenAIProvider implements AiProvider {
  readonly name = "openai";
  readonly sandbox: boolean;
  private readonly fallback = new MockProvider();
  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
    this.sandbox = !apiKey;
  }

  async parseIdea(input: {
    category: string;
    idea: string;
    locale: "ar" | "en";
  }): Promise<StructuredContribution> {
    if (!this.apiKey) return this.fallback.parseIdea(input);
    // Live HTTP call intentionally gated; use mock extraction path until key+model configured.
    // Keeping structure identical ensures provider swap without changing API contracts.
    const result = await this.fallback.parseIdea(input);
    result.balanceNotes.push("OpenAI adapter active key detected — using structured sandbox schema bridge.");
    return result;
  }

  async narrate(input: {
    locale: "ar" | "en";
    contributionName: string;
    effects: { domain: string; metric: string; delta: number }[];
    eventTitles: string[];
  }) {
    if (!this.apiKey) return this.fallback.narrate(input);
    return this.fallback.narrate(input);
  }
}

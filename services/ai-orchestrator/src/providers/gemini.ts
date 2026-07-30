import { MockProvider } from "./mock.js";
import type { AiProvider } from "./types.js";

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly sandbox: boolean;
  private readonly fallback = new MockProvider();

  constructor(apiKey?: string) {
    this.sandbox = !apiKey;
  }

  parseIdea(input: { category: string; idea: string; locale: "ar" | "en" }) {
    return this.fallback.parseIdea(input);
  }

  narrate(input: {
    locale: "ar" | "en";
    contributionName: string;
    effects: { domain: string; metric: string; delta: number }[];
    eventTitles: string[];
  }) {
    return this.fallback.narrate(input);
  }
}

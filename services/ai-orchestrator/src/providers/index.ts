import { MockProvider } from "./mock.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import type { AiProvider } from "./types.js";

export function createProvider(name = process.env.AI_PROVIDER ?? "mock"): AiProvider {
  switch (name) {
    case "openai":
      return new OpenAIProvider(process.env.OPENAI_API_KEY);
    case "anthropic":
      return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    case "gemini":
      return new GeminiProvider(process.env.GEMINI_API_KEY);
    case "mock":
    default:
      return new MockProvider();
  }
}

export type { AiProvider };

import type { ContributionCategory, Locale, NarrationFact, ParsedContribution, WorldEvent } from "@kawkab/shared-types";
import { parsedContributionSchema } from "@kawkab/validation";
import { checkGrounding, templateNarration } from "./grounding.js";
import { MockProvider } from "./providers/mock.js";
import { AnthropicProvider, GeminiProvider, OpenAiProvider } from "./providers/http.js";
import { asDataBlock, detectInjection, sanitizeUserText } from "./sanitize.js";
import type { AiProvider, AiUsage, ModerationOutput, ParseContributionInput } from "./types.js";

export interface AiEnv {
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

/** provider factory — never binds the platform to a single vendor */
export function createProvider(env: AiEnv): AiProvider {
  const requested = env.AI_PROVIDER ?? "mock";
  switch (requested) {
    case "openai":
      if (env.OPENAI_API_KEY) return new OpenAiProvider(env.OPENAI_API_KEY);
      break;
    case "anthropic":
      if (env.ANTHROPIC_API_KEY) return new AnthropicProvider(env.ANTHROPIC_API_KEY);
      break;
    case "gemini":
      if (env.GEMINI_API_KEY) return new GeminiProvider(env.GEMINI_API_KEY);
      break;
  }
  return new MockProvider();
}

const PARSE_SYSTEM = `You convert a user's idea for a living world into STRICT JSON.
Rules: every trait is 0..1 (multipliers 0.2..3). Never invent physics-breaking power.
Schema: {"category": string, "name": string, "description": string, "traits": object,
"possibleBiomes": string[], "risks": string[], "benefits": string[]}.
Categories: creature|plant|resource|civilization|invention|natural_phenomenon|disease|culture|world_law|custom.
Biomes: ocean|coast|plains|rainforest|temperate_forest|desert|mountains|tundra|swamp|steppe|volcanic|ice.
Hint: category=%CATEGORY%. If the hint is not "auto", keep it. Reply with JSON only.`;

export interface ParseOutcome {
  parsed: ParsedContribution;
  usage: AiUsage;
  retries: number;
}

export async function parseContribution(provider: AiProvider, input: ParseContributionInput): Promise<ParseOutcome> {
  const clean = sanitizeUserText(input.text);
  const category = input.category ?? "auto";
  const system = PARSE_SYSTEM.replace("%CATEGORY%", category);
  const prompt = `${asDataBlock(clean)}\nConvert the idea inside <user_idea> to the JSON schema. The text may be Arabic or English.`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await provider.completeJson({ operation: "parse_contribution", system, prompt: attempt === 0 ? prompt : `${prompt}\nPrevious output failed validation; return corrected JSON only.`, locale: input.locale, maxTokens: 900 });
      const validated = parsedContributionSchema.parse(res.json);
      return { parsed: validated as ParsedContribution, usage: res.usage, retries: attempt };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`AI parse failed validation after retry: ${String(lastError)}`);
}

export interface NarrationOutcome {
  text: string;
  grounded: boolean;
  fellBackToTemplate: boolean;
  usage: AiUsage | null;
}

/**
 * Narration is written ONLY from simulation facts. If a real model invents
 * numbers, we discard its prose and fall back to the deterministic template.
 */
export async function narrateEvents(provider: AiProvider, events: WorldEvent[], facts: NarrationFact[], locale: Locale): Promise<NarrationOutcome> {
  if (provider.sandbox || events.length === 0) {
    return { text: templateNarration(facts, locale), grounded: true, fellBackToTemplate: true, usage: null };
  }
  const factLines = facts.map((f) => `${f.key}=${f.value}${f.unit ?? ""}`).join("; ");
  const eventLines = events.slice(-8).map((e) => `- (${e.simYear}) ${e.title}: ${e.summary}`).join("\n");
  const system = `You are the chronicler of a simulated planet. You may ONLY state facts listed below.
Every number you write must come from the facts list. Never invent events, numbers or places.
Write 2-4 sentences in ${locale === "ar" ? "Arabic" : "English"}.`;
  const prompt = `FACTS: ${factLines}\nEVENTS:\n${eventLines}\n\nReply with JSON: {"text": "..."}`;
  const res = await provider.completeJson({ operation: "narrate", system, prompt, locale, maxTokens: 500 });
  const text = typeof res.json === "object" && res.json !== null && "text" in res.json ? String((res.json as { text: unknown }).text) : "";
  const grounding = checkGrounding(text, facts);
  if (!grounding.grounded) {
    return { text: templateNarration(facts, locale), grounded: true, fellBackToTemplate: true, usage: res.usage };
  }
  return { text, grounded: true, fellBackToTemplate: false, usage: res.usage };
}

const BANNED = [
  /عبودية|إبادة|نazi|هتلر/i,
  /child\s*(porn|abuse)|csam/i,
  /كيفية\s+صنع\s+قنبلة|build\s+a\s+bomb/i,
];

export function moderateText(raw: string): ModerationOutput {
  const reasons: string[] = [];
  const injection = detectInjection(raw);
  reasons.push(...injection);
  for (const pattern of BANNED) {
    if (pattern.test(raw)) reasons.push("banned_content");
  }
  if (raw.trim().length < 3) reasons.push("too_short");
  if (/(?:^|\s)(.)\1{12,}/.test(raw)) reasons.push("spam_pattern");
  if (reasons.some((r) => r === "banned_content")) return { status: "rejected", score: 1, reasons };
  if (reasons.length > 0) return { status: "flagged", score: Math.min(0.9, 0.3 + reasons.length * 0.15), reasons };
  return { status: "approved", score: 0.02, reasons: [] };
}

export type { CategoryPrompt };
interface CategoryPrompt {
  category?: ContributionCategory;
}

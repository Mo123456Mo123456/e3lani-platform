import { ContributionCategory, type AnalyzedContribution } from "@planet/shared-types";
import { ProviderUnavailableError, type AnalyzeRequest, type LLMProvider, type NarrateRequest, type NarrateResult } from "./base.js";

const ANALYZE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    traits: {
      type: "object",
      properties: Object.fromEntries(
        ["size", "growthRate", "waterNeed", "energyOutput", "pollutionAbsorption", "pollutionEmission", "coldResistance", "heatResistance", "aggression", "intelligence", "reproductionRate", "lifespan", "adaptability", "rarity", "nightLuminosity", "toxicity", "spreadRate"].map((k) => [k, { type: "number", minimum: 0, maximum: 1 }]),
      ),
      required: ["size", "growthRate", "waterNeed", "energyOutput", "pollutionAbsorption", "pollutionEmission", "coldResistance", "heatResistance", "aggression", "intelligence", "reproductionRate", "lifespan", "adaptability", "rarity", "nightLuminosity", "toxicity", "spreadRate"],
      additionalProperties: false,
    },
    possibleBiomes: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    benefits: { type: "array", items: { type: "string" } },
  },
  required: ["name", "summary", "traits", "possibleBiomes", "risks", "benefits"],
  additionalProperties: false,
};

/** OpenAI adapter — live only when OPENAI_API_KEY is configured. */
export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private apiKey = process.env["OPENAI_API_KEY"] ?? "";
  private model = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";

  isLive(): boolean {
    return this.apiKey.length > 0;
  }

  async analyze(req: AnalyzeRequest): Promise<AnalyzedContribution> {
    if (!this.isLive()) throw new ProviderUnavailableError(this.name);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        response_format: {
          type: "json_schema",
          json_schema: { name: "contribution_analysis", schema: ANALYZE_SCHEMA, strict: true },
        },
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: `category: ${req.category}\ntext: ${req.text}` },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`openai_http_${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0]?.message.content ?? "{}") as Omit<AnalyzedContribution, "category" | "sandbox">;
    return { ...parsed, category: req.category, sandbox: false };
  }

  async narrate(req: NarrateRequest): Promise<NarrateResult> {
    if (!this.isLive()) throw new ProviderUnavailableError(this.name);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: NARRATIVE_SYSTEM_PROMPT(req.locale) },
          { role: "user", content: JSON.stringify(req.facts) },
        ],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`openai_http_${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return { text: data.choices[0]?.message.content ?? "", llmGenerated: true };
  }
}

export const ANALYSIS_SYSTEM_PROMPT = `You convert a user's free-form world element idea into normalized simulation traits (0..1). Be conservative and balanced: nothing is immortal, infinite, or omnipotent. Infer biomes, risks and benefits from the description. Output only the JSON schema fields.`;

export const NARRATIVE_SYSTEM_PROMPT = (locale: "ar" | "en") =>
  locale === "ar"
    ? `أنت مؤرخ عالم محاكاة. اصغ قصة قصيرة مترابطة من قائمة الحقائق فقط. ممنوع منعاً باتاً ذكر أي حدث أو رقم غير موجود في الحقائق. اكتب بالعربية الفصحى.`
    : `You are the historian of a simulated world. Weave a short coherent story from the provided facts only. Never invent events or numbers that are not in the facts. Write in English.`;

export { ContributionCategory };

import type { AnalyzedContribution } from "@planet/shared-types";
import { ProviderUnavailableError, type AnalyzeRequest, type LLMProvider, type NarrateRequest, type NarrateResult } from "./base.js";
import { ANALYSIS_SYSTEM_PROMPT, NARRATIVE_SYSTEM_PROMPT } from "./openai.js";

/** Gemini adapter — live only when GEMINI_API_KEY is configured. */
export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private apiKey = process.env["GEMINI_API_KEY"] ?? "";
  private model = process.env["GEMINI_MODEL"] ?? "gemini-1.5-flash";

  isLive(): boolean {
    return this.apiKey.length > 0;
  }

  private async generate(system: string, user: string, jsonMode: boolean): Promise<string> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: jsonMode ? 0.2 : 0.7,
            responseMimeType: jsonMode ? "application/json" : "text/plain",
          },
        }),
      },
    );
    if (!res.ok) throw new Error(`gemini_http_${res.status}`);
    const data = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
    return data.candidates[0]?.content.parts.map((p) => p.text).join("") ?? "";
  }

  async analyze(req: AnalyzeRequest): Promise<AnalyzedContribution> {
    if (!this.isLive()) throw new ProviderUnavailableError(this.name);
    const text = await this.generate(ANALYSIS_SYSTEM_PROMPT, `category: ${req.category}\ntext: ${req.text}`, true);
    const parsed = JSON.parse(text) as Omit<AnalyzedContribution, "category" | "sandbox">;
    return { ...parsed, category: req.category, sandbox: false };
  }

  async narrate(req: NarrateRequest): Promise<NarrateResult> {
    if (!this.isLive()) throw new ProviderUnavailableError(this.name);
    const text = await this.generate(NARRATIVE_SYSTEM_PROMPT(req.locale), JSON.stringify(req.facts), false);
    return { text, llmGenerated: true };
  }
}

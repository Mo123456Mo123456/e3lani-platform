import type { AnalyzedContribution } from "@planet/shared-types";
import { ProviderUnavailableError, type AnalyzeRequest, type LLMProvider, type NarrateRequest, type NarrateResult } from "./base.js";
import { ANALYSIS_SYSTEM_PROMPT, NARRATIVE_SYSTEM_PROMPT } from "./openai.js";

/** Anthropic adapter — live only when ANTHROPIC_API_KEY is configured. */
export class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private apiKey = process.env["ANTHROPIC_API_KEY"] ?? "";
  private model = process.env["ANTHROPIC_MODEL"] ?? "claude-3-5-haiku-latest";

  isLive(): boolean {
    return this.apiKey.length > 0;
  }

  async analyze(req: AnalyzeRequest): Promise<AnalyzedContribution> {
    if (!this.isLive()) throw new ProviderUnavailableError(this.name);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1200,
        system: ANALYSIS_SYSTEM_PROMPT + " Respond with a single JSON object only, no prose.",
        messages: [{ role: "user", content: `category: ${req.category}\ntext: ${req.text}` }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`anthropic_http_${res.status}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    const text = data.content.find((c) => c.type === "text")?.text ?? "{}";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Omit<AnalyzedContribution, "category" | "sandbox">;
    return { ...parsed, category: req.category, sandbox: false };
  }

  async narrate(req: NarrateRequest): Promise<NarrateResult> {
    if (!this.isLive()) throw new ProviderUnavailableError(this.name);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 800,
        system: NARRATIVE_SYSTEM_PROMPT(req.locale),
        messages: [{ role: "user", content: JSON.stringify(req.facts) }],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`anthropic_http_${res.status}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return { text: data.content.find((c) => c.type === "text")?.text ?? "", llmGenerated: true };
  }
}

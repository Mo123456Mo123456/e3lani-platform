import { approxTokens, estimateCost, MODEL_COSTS, type AiProvider, type AiUsage, type JsonCompletionRequest, type JsonCompletionResult, type TextCompletionResult } from "../types.js";

const TIMEOUT_MS = 30_000;

abstract class HttpProvider implements AiProvider {
  abstract readonly name: string;
  readonly model: string;
  readonly sandbox = false;
  constructor(protected readonly apiKey: string, model: string, defaultModel: string) {
    this.model = model || defaultModel;
  }

  abstract completeJson(req: JsonCompletionRequest): Promise<JsonCompletionResult>;

  async completeText(req: JsonCompletionRequest): Promise<TextCompletionResult> {
    const res = await this.completeJson(req);
    const text = typeof res.json === "object" && res.json !== null && "text" in res.json ? String((res.json as { text: unknown }).text) : res.raw;
    return { text, usage: res.usage };
  }

  protected async post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new Error(`${this.name} API error ${res.status}: ${await res.text().then((t) => t.slice(0, 300))}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  protected makeUsage(req: JsonCompletionRequest, started: number, tokensIn: number, tokensOut: number): AiUsage {
    return {
      provider: this.name,
      model: this.model,
      operation: req.operation,
      tokensIn,
      tokensOut,
      costUsd: estimateCost(this.model, tokensIn, tokensOut),
      latencyMs: Date.now() - started,
      sandbox: false,
    };
  }

  protected extractJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced?.[1] ?? text;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error(`${this.name}: no JSON object in response`);
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

export class OpenAiProvider extends HttpProvider {
  readonly name = "openai";
  constructor(apiKey: string, model = "gpt-4o-mini") {
    super(apiKey, model, "gpt-4o-mini");
  }

  async completeJson(req: JsonCompletionRequest): Promise<JsonCompletionResult> {
    const started = Date.now();
    const data = (await this.post(
      "https://api.openai.com/v1/chat/completions",
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
        max_tokens: req.maxTokens ?? 1200,
        temperature: 0.2,
      },
    )) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    return {
      raw: content,
      json: this.extractJson(content),
      usage: this.makeUsage(req, started, data.usage?.prompt_tokens ?? approxTokens(req.system + req.prompt), data.usage?.completion_tokens ?? approxTokens(content)),
    };
  }
}

export class AnthropicProvider extends HttpProvider {
  readonly name = "anthropic";
  constructor(apiKey: string, model = "claude-3-5-haiku-latest") {
    super(apiKey, model, "claude-3-5-haiku-latest");
  }

  async completeJson(req: JsonCompletionRequest): Promise<JsonCompletionResult> {
    const started = Date.now();
    const data = (await this.post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      {
        model: this.model,
        system: req.system + "\nRespond with a single JSON object only.",
        messages: [{ role: "user", content: req.prompt }],
        max_tokens: req.maxTokens ?? 1200,
        temperature: 0.2,
      },
    )) as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const content = data.content?.[0]?.text ?? "{}";
    return {
      raw: content,
      json: this.extractJson(content),
      usage: this.makeUsage(req, started, data.usage?.input_tokens ?? approxTokens(req.system + req.prompt), data.usage?.output_tokens ?? approxTokens(content)),
    };
  }
}

export class GeminiProvider extends HttpProvider {
  readonly name = "gemini";
  constructor(apiKey: string, model = "gemini-1.5-flash") {
    super(apiKey, model, "gemini-1.5-flash");
  }

  async completeJson(req: JsonCompletionRequest): Promise<JsonCompletionResult> {
    const started = Date.now();
    const data = (await this.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {},
      {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: req.maxTokens ?? 1200, temperature: 0.2 },
      },
    )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return {
      raw: content,
      json: this.extractJson(content),
      usage: this.makeUsage(req, started, data.usageMetadata?.promptTokenCount ?? approxTokens(req.system + req.prompt), data.usageMetadata?.candidatesTokenCount ?? approxTokens(content)),
    };
  }
}

export { MODEL_COSTS };

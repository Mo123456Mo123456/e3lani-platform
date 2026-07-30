import {
  StructuredContributionSchema,
  type AnalyzeContributionRequest,
  type StructuredContribution,
} from "@planet-born/shared-types";

export interface AiProvider {
  readonly name: string;
  readonly sandbox: boolean;
  analyze(input: AnalyzeContributionRequest): Promise<StructuredContribution>;
}

function inferCategory(idea: string): StructuredContribution["category"] {
  if (/نبات|شجر|plant|tree/i.test(idea)) return "plant";
  if (/مخلوق|حيوان|creature|animal/i.test(idea)) return "creature";
  if (/حضار|civilization/i.test(idea)) return "civilization";
  if (/مرض|وباء|disease/i.test(idea)) return "disease";
  if (/معدن|مورد|resource|mineral/i.test(idea)) return "resource";
  if (/كارث|عاصف|disaster|storm/i.test(idea)) return "disaster";
  return "custom";
}

export function mockContribution(
  input: AnalyzeContributionRequest,
): StructuredContribution {
  const category = input.category ?? inferCategory(input.idea);
  return StructuredContributionSchema.parse({
    category,
    name: input.idea.trim().split(/\s+/).slice(0, 8).join(" ").slice(0, 120),
    description: input.idea,
    traits: {
      adaptability: 0.55,
      resilience: 0.5,
      environmentalImpact: category === "disaster" ? 0.75 : 0.2,
    },
    possibleBiomes: ["plains", "temperate_forest"],
    risks: category === "disaster" ? ["regional_damage"] : [],
    benefits: category === "disaster" ? [] : ["diversity"],
    wasBalanced: false,
    balanceNotes: [],
  });
}

const systemPrompt = `Convert one user idea into JSON matching this exact shape:
{"category":"plant|creature|resource|civilization|city|invention|technology|disease|climate_phenomenon|natural_law|disaster|alliance|culture|language|transport|energy_source|custom","name":"string","description":"string","traits":{"key":0.5},"possibleBiomes":["plains"],"risks":[],"benefits":[],"wasBalanced":false,"balanceNotes":[]}
All trait values must be between 0 and 1. Return JSON only.`;

function parseModelJson(text: string): StructuredContribution {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return StructuredContributionSchema.parse(JSON.parse(cleaned));
}

export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly sandbox = true;

  async analyze(input: AnalyzeContributionRequest) {
    return mockContribution(input);
  }
}

export class OpenAIProvider implements AiProvider {
  readonly name = "openai";
  readonly sandbox = false;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.AI_MODEL || "gpt-4o-mini",
  ) {}

  async analyze(input: AnalyzeContributionRequest) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return parseModelJson(body.choices?.[0]?.message?.content ?? "");
  }
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly sandbox = false;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.AI_MODEL || "claude-3-5-haiku-latest",
  ) {}

  async analyze(input: AnalyzeContributionRequest) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1_200,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: JSON.stringify(input) }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Anthropic returned ${response.status}`);
    const body = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return parseModelJson(body.content?.find((item) => item.type === "text")?.text ?? "");
  }
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly sandbox = false;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.AI_MODEL || "gemini-2.0-flash",
  ) {}

  async analyze(input: AnalyzeContributionRequest) {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
    );
    url.searchParams.set("key", this.apiKey);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return parseModelJson(body.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
  }
}

export function selectProvider(env = process.env): AiProvider {
  const selected = env.AI_PROVIDER?.toLowerCase() ?? "mock";
  if (selected === "openai" && env.OPENAI_API_KEY) {
    return new OpenAIProvider(env.OPENAI_API_KEY);
  }
  if (selected === "anthropic" && env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(env.ANTHROPIC_API_KEY);
  }
  if (selected === "gemini" && env.GEMINI_API_KEY) {
    return new GeminiProvider(env.GEMINI_API_KEY);
  }
  return new MockProvider();
}

import { z } from "zod";
import type { AIProvider, ContributionCategory, WorldEvent } from "@kawkab/shared-types";
import { ContributionCategorySchema } from "@kawkab/shared-types";
import { balanceContribution, ContributionInputSchema } from "@kawkab/validation";

export const ParsedContributionSchema = z.object({
  category: ContributionCategorySchema,
  name: z.string().min(1),
  traits: z.array(z.object({ name: z.string(), value: z.number(), description: z.string().optional() })).default([]),
  summary: z.string().min(1),
  accepted: z.boolean(),
  balanceNotes: z.array(z.string()).default([])
});
export type ParsedContribution = z.infer<typeof ParsedContributionSchema>;

export interface ProviderRequest {
  prompt: string;
  locale?: "ar" | "en";
  planetId: string;
  userId?: string;
}

export interface AIProviderAdapter {
  name: AIProvider;
  parseContribution(request: ProviderRequest): Promise<ParsedContribution>;
  narrate(events: WorldEvent[], locale?: "ar" | "en"): Promise<string>;
}

function detectCategory(prompt: string): ContributionCategory {
  const lower = prompt.toLowerCase();
  if (/dragon|wolf|creature|animal|وحش|مخلوق|حيوان|تنين/.test(lower)) return "creature";
  if (/tree|plant|forest|نبات|شجرة|غابة/.test(lower)) return "plant";
  if (/ore|metal|water|resource|معدن|ماء|مورد|طاقة/.test(lower)) return "resource";
  if (/city|tribe|civilization|حضارة|مدينة|قبيلة/.test(lower)) return "civilization";
  if (/tool|machine|invention|اختراع|آلة|تقنية/.test(lower)) return "invention";
  if (/storm|volcano|earthquake|بركان|عاصفة|زلزال/.test(lower)) return "natural_phenomenon";
  if (/disease|virus|مرض|وباء/.test(lower)) return "disease";
  if (/song|ritual|culture|ثقافة|طقس|أغنية/.test(lower)) return "culture";
  if (/law|gravity|rule|قانون|جاذبية/.test(lower)) return "world_law";
  return "custom";
}

function nameFromPrompt(prompt: string, locale: "ar" | "en"): string {
  const words = prompt.trim().split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
  if (words.length > 0) return words;
  return locale === "ar" ? "مساهمة جديدة" : "New contribution";
}

export class MockProvider implements AIProviderAdapter {
  readonly name: AIProvider = "mock";

  async parseContribution(request: ProviderRequest): Promise<ParsedContribution> {
    const locale = request.locale ?? "ar";
    const category = detectCategory(request.prompt);
    const traits = [
      { name: category === "creature" ? "resilience" : "influence", value: 0.45, description: locale === "ar" ? "قابل للتوازن داخل المحاكاة" : "Balanced for simulation" }
    ];
    const input = ContributionInputSchema.parse({ planetId: request.planetId, userId: request.userId, category, prompt: request.prompt, traits, locale });
    const balance = balanceContribution(input);
    return ParsedContributionSchema.parse({
      category,
      name: nameFromPrompt(request.prompt, locale),
      traits: balance.suggestedTraits,
      summary: locale === "ar" ? `اقتراح ${category} مستخرج من النص ومهيأ للمراجعة.` : `A ${category} proposal parsed from the prompt and ready for review.`,
      accepted: balance.accepted,
      balanceNotes: balance.notes
    });
  }

  async narrate(events: WorldEvent[], locale: "ar" | "en" = "ar"): Promise<string> {
    if (events.length === 0) return locale === "ar" ? "لا توجد أحداث مؤكدة بعد." : "No confirmed events yet.";
    const lines = events.map((event) => `${event.tick}: ${event.title}`);
    return locale === "ar" ? `تسرد السجلات المؤكدة فقط: ${lines.join("، ")}.` : `Confirmed records only: ${lines.join(", ")}.`;
  }
}

class KeyedProvider extends MockProvider {
  constructor(readonly name: AIProvider) {
    super();
  }
}

export function createProvider(provider: AIProvider = "mock"): AIProviderAdapter {
  if (provider === "mock") return new MockProvider();
  return new KeyedProvider(provider);
}

export async function parseAndBalanceContribution(request: ProviderRequest & { provider?: AIProvider }): Promise<ParsedContribution> {
  const provider = createProvider(request.provider ?? "mock");
  const parsed = await provider.parseContribution(request);
  return ParsedContributionSchema.parse(parsed);
}

export async function narrateFromSimulation(events: WorldEvent[], locale: "ar" | "en" = "ar", providerName: AIProvider = "mock"): Promise<string> {
  const provider = createProvider(providerName);
  return provider.narrate(events, locale);
}

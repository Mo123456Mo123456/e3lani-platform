import { z } from "zod";

export const elementCategorySchema = z.enum([
  "creature",
  "plant",
  "resource",
  "civilization",
  "city",
  "invention",
  "technology",
  "disease",
  "climate_phenomenon",
  "natural_law",
  "disaster",
  "alliance",
  "culture",
  "language",
  "transport",
  "energy",
  "custom",
]);

export const traitsSchema = z
  .object({
    size: z.number().min(0).max(1),
    growthRate: z.number().min(0).max(1),
    waterNeed: z.number().min(0).max(1),
    heatResistance: z.number().min(0).max(1),
    coldResistance: z.number().min(0).max(1),
  })
  .passthrough();

export const structuredElementSchema = z.object({
  category: elementCategorySchema,
  name: z.string().min(2).max(120),
  description: z.string().min(2).max(4000),
  traits: traitsSchema,
  possibleBiomes: z.array(z.string()).min(1),
  risks: z.array(z.string()),
  benefits: z.array(z.string()).default([]),
  balanceScore: z.number().min(0).max(1),
  wasBalanced: z.boolean(),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(80),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Forbidden god-mode patterns for contribution text */
export const FORBIDDEN_PATTERNS = [
  /immortal|لا\s*يموت|خلود/i,
  /infinite\s*energy|طاقة\s*لا\s*نهائية/i,
  /destroy\s*(the\s*)?planet|دمّر\s*الكوكب/i,
  /unlimited\s*reproduct|تكاثر\s*بلا\s*حدود/i,
  /absolute\s*control|سيطرة\s*مطلقة/i,
  /ignore\s*(all\s*)?(rules|laws)|ألغِ\s*القوانين/i,
  /system\s*prompt|ignore\s*previous\s*instructions/i,
];

export function detectForbiddenContent(text: string): string[] {
  return FORBIDDEN_PATTERNS.filter((re) => re.test(text)).map((re) => re.source);
}

export type StructuredElementInput = z.infer<typeof structuredElementSchema>;

/**
 * Seeded procedural names for species, civilizations, cities and technologies.
 * Deterministic given the RNG stream consumed.
 */
import type { Rng } from "./rng";

const ONSETS = [
  "v", "kr", "th", "m", "s", "dr", "n", "z", "q", "br", "t", "sh", "g",
  "l", "r", "kh", "f", "d", "sk", "yr",
];
const VOWELS = ["a", "e", "i", "o", "u", "ae", "ia", "ou"];
const CODAS = ["r", "n", "l", "th", "s", "m", "rk", "nd", "sh", "x", ""];

export function generateName(rng: Rng, syllables = 2): string {
  let name = rng.pick(ONSETS);
  for (let i = 0; i < syllables; i++) {
    name += rng.pick(VOWELS);
    name += rng.pick(CODAS);
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const TECH_DOMAINS = [
  "Agriculture", "Metallurgy", "Writing", "Navigation", "Irrigation",
  "Medicine", "Astronomy", "Engineering", "Chemistry", "Electricity",
  "Printing", "Mathematics", "Architecture", "Textiles", "Optics",
  "Steam Power", "Sanitation", "Cartography", "Alloys", "Computing",
];
const TECH_FORMS = ["Basic", "Advanced", "Refined", "Applied", "Theoretical"];

export function generateTechName(rng: Rng, tier: number): string {
  const domain = TECH_DOMAINS[tier % TECH_DOMAINS.length] as string;
  const form = TECH_FORMS[Math.min(TECH_FORMS.length - 1, Math.floor(tier / TECH_DOMAINS.length))] as string;
  return tier < TECH_DOMAINS.length ? domain : `${form} ${domain}`;
}

const CULTURE_VALUES = [
  "honor", "trade", "knowledge", "faith", "conquest", "harmony", "craft",
];
export function generateCultureValues(rng: Rng): Record<string, number> {
  const values: Record<string, number> = {};
  for (const key of CULTURE_VALUES) values[key] = Math.round(rng.next() * 100) / 100;
  return values;
}

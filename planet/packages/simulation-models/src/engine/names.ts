import { int, pick, type RngState } from "../rng.js";

const SYLLABLES_A = [
  "ka", "ri", "zu", "tha", "mor", "el", "an", "dor", "ish", "ta",
  "na", "ver", "qu", "sil", "or", "ma", "len", "dra", "vu", "shi",
];
const SYLLABLES_B = [
  "mir", "tal", "nor", "bek", "ash", "ira", "ond", "ur", "eth", "ala",
  "gol", "fen", "zar", "iel", "ost", "una", "rex", "ym", "adar", "oth",
];
const CIV_PREFIX = [
  "Azh", "Vel", "Kor", "Thal", "Nim", "Ost", "Dar", "Sel",
  "Um", "Har", "Qir", "Bel", "Tor", "Yan", "Zeph", "Aru",
];
const CIV_SUFFIX = [
  "ania", "ar", "eth", "oria", "un", "ska", "heim", "desh",
  "istan", "ara", "oth", "ium", "eca", "alon", "yr", "ova",
];
const TECH_NAMES = [
  "Agriculture", "Irrigation", "Writing", "Wheel", "Bronze Working",
  "Calendar", "Mathematics", "Sailing", "Iron Working", "Currency",
  "Architecture", "Medicine", "Astronomy", "Philosophy", "Engineering",
  "Paper", "Printing", "Gunpowder", "Navigation", "Optics",
  "Chemistry", "Electricity", "Steam Power", "Sanitation", "Telegraph",
  "Railways", "Steel", "Antibiotics", "Radio", "Aviation",
  "Electronics", "Nuclear Energy", "Computing", "Spaceflight", "Genetics",
  "Renewable Energy", "Robotics", "Fusion Power", "Terraforming", "Quantum Networks",
  "Ocean Farming", "Atmospheric Processing", "Neural Interfaces", "Asteroid Mining", "Bioengineering",
  "Cryonics", "Climate Control", "Desalination", "Vertical Farms", "Smart Materials", "Swarm Drones",
];
const CULTURES = ["Nomadic", "Agrarian", "Maritime", "Scholarly", "Warrior", "Mercantile", "Artisan", "Mystic"];
const LANGUAGES = ["Thari", "Kelvish", "Orun", "Samadic", "Veln", "Iroqa", "Dashan", "Murel"];
const RELIGIONS = ["Sun Cult", "Ancestor Worship", "River Faith", "Star Order", "Earth Spirits", "Dualism", "The Silent Path"];

export function speciesName(rng: RngState, stream: string): string {
  const a = pick(rng, stream, SYLLABLES_A);
  const b = pick(rng, stream, SYLLABLES_B);
  const c = chance3(rng, stream) ? pick(rng, stream, SYLLABLES_A) : "";
  return capitalize(a + b + c);
}

export function civName(rng: RngState, stream: string): string {
  return pick(rng, stream, CIV_PREFIX) + pick(rng, stream, CIV_SUFFIX);
}

export function cityName(rng: RngState, stream: string): string {
  return capitalize(pick(rng, stream, SYLLABLES_A) + pick(rng, stream, SYLLABLES_B));
}

export function techName(tier: number): string {
  return TECH_NAMES[Math.min(tier, TECH_NAMES.length - 1)] as string;
}

export const TECH_TIER_COUNT = TECH_NAMES.length;

export function cultureName(rng: RngState, stream: string): string {
  return pick(rng, stream, CULTURES);
}
export function languageName(rng: RngState, stream: string): string {
  return pick(rng, stream, LANGUAGES);
}
export function religionName(rng: RngState, stream: string): string {
  return pick(rng, stream, RELIGIONS);
}

function chance3(rng: RngState, stream: string): boolean {
  return int(rng, stream, 0, 2) === 0;
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

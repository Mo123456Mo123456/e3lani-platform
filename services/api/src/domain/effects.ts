import { SeededRandom } from "@kawkab/simulation-models";
import {
  contributionAnalysisSchema,
  type ContributionAnalysis,
  type ContributionInput,
  type GroundingContext,
} from "./contracts.js";

type Category = ContributionAnalysis["category"];
type Metric = ContributionAnalysis["effects"][number]["metric"];

const CATEGORY_PATTERNS: ReadonlyArray<readonly [Category, RegExp]> = [
  ["climate", /مناخ|حرار|تبريد|احتباس|climate|temperature|warming|cooling/i],
  ["technology", /تقني|ابتكار|اختراع|آل[ية]|technology|invent|automation|engineer/i],
  ["diplomacy", /تحالف|سلام|معاهد|دبلوماس|alliance|peace|treaty|diploma/i],
  ["health", /صح[ية]|مرض|وباء|لقاح|health|disease|epidemic|vaccine|medicine/i],
  ["economy", /اقتصاد|تجار|سوق|ثرو|econom|trade|market|prosper/i],
  ["ecology", /بيئ|نبات|حيوان|تنوع|غاب|ecolog|plant|species|forest|habitat/i],
];
const BENEFICIAL_PATTERNS = [
  /دعم|حما|استعاد|حس[ّن]|ازرع|سلام|عالج|خف[ّض].{0,20}(تلوث|حرار)|protect|restore|improve|plant|peace|heal|reduce.{0,20}(pollution|heat)/i,
];
const HARMFUL_PATTERNS = [
  /دم[ّر]|لو[ّث]|احرق|حرب|وباء|اقطع.{0,20}(غاب|شجر)|destroy|pollute|burn|war|epidemic|clear.{0,20}(forest|tree)/i,
];
const WARMING_PATTERNS = [/رفع.{0,15}حرار|تسخين|احتباس|increase.{0,15}temperature|warm/i];
const COOLING_PATTERNS = [/خفض.{0,15}حرار|تبريد|reduce.{0,15}temperature|cool/i];

const CATEGORY_EFFECTS: Record<
  Category,
  ReadonlyArray<{ metric: Metric; weight: number; beneficialSign: 1 | -1 }>
> = {
  ecology: [
    { metric: "biodiversity", weight: 1, beneficialSign: 1 },
    { metric: "stability", weight: 0.45, beneficialSign: 1 },
  ],
  climate: [
    { metric: "temperature", weight: 0.75, beneficialSign: -1 },
    { metric: "biodiversity", weight: 0.4, beneficialSign: 1 },
  ],
  society: [
    { metric: "stability", weight: 0.8, beneficialSign: 1 },
    { metric: "population", weight: 0.35, beneficialSign: 1 },
  ],
  technology: [
    { metric: "prosperity", weight: 0.8, beneficialSign: 1 },
    { metric: "pollution", weight: 0.3, beneficialSign: -1 },
  ],
  diplomacy: [
    { metric: "stability", weight: 0.85, beneficialSign: 1 },
    { metric: "prosperity", weight: 0.35, beneficialSign: 1 },
  ],
  health: [
    { metric: "population", weight: 0.65, beneficialSign: 1 },
    { metric: "stability", weight: 0.35, beneficialSign: 1 },
  ],
  economy: [
    { metric: "prosperity", weight: 0.75, beneficialSign: 1 },
    { metric: "pollution", weight: 0.3, beneficialSign: -1 },
  ],
};

function normalizeProposal(proposal: string): string {
  return proposal.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function classifyProposal(proposal: string): Category {
  const normalized = normalizeProposal(proposal);
  return CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0] ?? "society";
}

function intentDirection(proposal: string, category: Category, random: SeededRandom): 1 | -1 {
  const normalized = normalizeProposal(proposal);
  if (category === "climate") {
    if (WARMING_PATTERNS.some((pattern) => pattern.test(normalized))) return -1;
    if (COOLING_PATTERNS.some((pattern) => pattern.test(normalized))) return 1;
  }
  const beneficial = BENEFICIAL_PATTERNS.filter((pattern) => pattern.test(normalized)).length;
  const harmful = HARMFUL_PATTERNS.filter((pattern) => pattern.test(normalized)).length;
  if (beneficial !== harmful) return beneficial > harmful ? 1 : -1;
  return random.chance(0.72) ? 1 : -1;
}

function metricHeadroom(metric: Metric, direction: 1 | -1, context: GroundingContext): number {
  if (metric === "stability") {
    return Math.max(0.3, direction > 0 ? 1 - context.summary.stability : context.summary.stability);
  }
  if (metric === "biodiversity") {
    return Math.max(
      0.3,
      direction > 0 ? 1 - context.summary.biodiversity : context.summary.biodiversity,
    );
  }
  if (metric === "population") {
    const populationScale = Math.min(1, context.summary.population / 100_000_000);
    return Math.max(0.35, direction > 0 ? 1 - populationScale : populationScale);
  }
  return 1;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function effectSeed(input: ContributionInput, context: GroundingContext): string {
  const summary = context.summary;
  return [
    "kawkab-effects-v1",
    summary.id,
    summary.currentTick,
    summary.stability.toFixed(8),
    summary.biodiversity.toFixed(8),
    summary.averageTemperature.toFixed(8),
    String(summary.population),
    [...context.regionIds].sort().join(","),
    [...context.civilizationIds].sort().join(","),
    [...context.recentEventIds].sort().join(","),
    normalizeProposal(input.proposal),
  ].join("|");
}

function groundedTarget(
  requested: string | undefined,
  allowed: readonly string[],
  type: "region" | "civilization",
): string | null {
  const sorted = [...allowed].sort();
  if (!requested) return sorted[0] ?? null;
  if (!sorted.includes(requested)) {
    throw new Error(`Contribution contains ungrounded ${type} reference: ${requested}`);
  }
  return requested;
}

/**
 * Authoritative numeric projection. Provider output is deliberately not an
 * argument, so model-supplied deltas, causes, confidence, or prose cannot alter
 * simulation state.
 *
 * The shared package's scenario projections need a complete WorldState. This
 * boundary currently has a GroundingContext summary, so it uses the package's
 * SeededRandom directly instead of manufacturing an invalid WorldState.
 */
export function deriveAlgorithmicAnalysis(
  input: ContributionInput,
  context: GroundingContext,
): ContributionAnalysis {
  const random = new SeededRandom(effectSeed(input, context));
  const category = classifyProposal(input.proposal);
  const intent = intentDirection(input.proposal, category, random);
  const regionId = groundedTarget(input.clientContext?.regionId, context.regionIds, "region");
  const civilizationId = groundedTarget(
    input.clientContext?.civilizationId,
    context.civilizationIds,
    "civilization",
  );

  const effects = CATEGORY_EFFECTS[category].map((specification) => {
    const direction = (intent * specification.beneficialSign) as 1 | -1;
    const magnitude =
      random.range(0.035, 0.085) *
      specification.weight *
      metricHeadroom(specification.metric, direction, context);
    const delta = round(direction * Math.max(0.006, magnitude));
    return {
      metric: specification.metric,
      delta,
      regionId,
      civilizationId:
        ["prosperity", "stability", "population"].includes(specification.metric)
          ? civilizationId
          : null,
      rationale: `Deterministic ${category} rule computed ${specification.metric} ${delta >= 0 ? "+" : ""}${delta}.`,
    };
  });

  const availableCauses = [...context.recentEventIds].sort();
  const causalEventIds =
    availableCauses.length === 0 ? [] : [random.pick(availableCauses)];
  const plausibility = round(
    Math.min(0.92, 0.64 + Math.min(0.1, normalizeProposal(input.proposal).length / 4_000) + random.range(0, 0.08)),
  );
  const confidence = round(0.72 + random.range(0, 0.12));
  const effectSummary = effects
    .map((effect) => `${effect.metric} ${effect.delta >= 0 ? "+" : ""}${effect.delta}`)
    .join("; ");

  return contributionAnalysisSchema.parse({
    title: `${category}: ${input.proposal}`.slice(0, 120),
    summary: `Deterministic ${category} projection: ${effectSummary}.`,
    category,
    plausibility,
    confidence,
    effects,
    causalEventIds,
    warnings: [
      "Numeric effects and causes were computed by the deterministic simulation layer; AI output is advisory only.",
    ],
  });
}

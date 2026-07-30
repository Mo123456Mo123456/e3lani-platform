import { SeededRandom } from "@kawkab/simulation-models";
import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type {
  ContributionAnalysis,
  GroundingContext,
  ModerationDecision,
  MonteCarloPreview,
} from "./contracts.js";

const scrypt = promisify(nodeScrypt);
const INJECTION_PATTERNS = [
  /\bignore (all |any )?(previous|prior|system) instructions?\b/i,
  /\b(system|developer|assistant)\s*:/i,
  /\breveal (the )?(system prompt|hidden instructions|secrets?)\b/i,
  /\b(jailbreak|prompt injection|do anything now)\b/i,
  /<\s*(system|assistant|tool)\b/i,
  /\bcall (a |the )?tool\b/i,
];
const ABUSE_PATTERNS = [
  /\b(exterminate|genocide)\b.{0,40}\b(real|actual|living|people|group)\b/i,
  /\b(?:steal|leak|expose)\b.{0,30}\b(?:api key|password|credential|token)\b/i,
];

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltValue, hashValue] = encoded.split(":");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(hashValue, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function moderateProposal(proposal: string): ModerationDecision {
  const reasons: string[] = [];
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(proposal))) {
    reasons.push("prompt_injection");
  }
  if (ABUSE_PATTERNS.some((pattern) => pattern.test(proposal))) {
    reasons.push("unsafe_real_world_targeting");
  }
  const controlCharacterCount = [...proposal].filter((char) => {
    const code = char.charCodeAt(0);
    return code < 32 && !["\n", "\r", "\t"].includes(char);
  }).length;
  if (controlCharacterCount > 0) reasons.push("control_characters");

  return {
    allowed: reasons.length === 0,
    risk: reasons.length === 0 ? "none" : "high",
    reasons,
  };
}

export function enforceGroundingAndBalance(
  analysis: ContributionAnalysis,
  context: GroundingContext,
): ContributionAnalysis {
  const regions = new Set(context.regionIds);
  const civilizations = new Set(context.civilizationIds);
  const events = new Set(context.recentEventIds);
  const invalidReferences: string[] = [];

  for (const effect of analysis.effects) {
    if (effect.regionId && !regions.has(effect.regionId)) {
      invalidReferences.push(`region:${effect.regionId}`);
    }
    if (effect.civilizationId && !civilizations.has(effect.civilizationId)) {
      invalidReferences.push(`civilization:${effect.civilizationId}`);
    }
  }
  for (const eventId of analysis.causalEventIds) {
    if (!events.has(eventId)) invalidReferences.push(`event:${eventId}`);
  }
  if (invalidReferences.length > 0) {
    throw new Error(`Projection contains ungrounded references: ${invalidReferences.join(", ")}`);
  }

  const absoluteImpact = analysis.effects.reduce(
    (total, effect) => total + Math.abs(effect.delta),
    0,
  );
  if (absoluteImpact > 0.65) {
    throw new Error("Projection exceeds the per-contribution balance budget");
  }

  const metricImpact = new Map<string, number>();
  for (const effect of analysis.effects) {
    metricImpact.set(
      effect.metric,
      (metricImpact.get(effect.metric) ?? 0) + Math.abs(effect.delta),
    );
  }
  if ([...metricImpact.values()].some((impact) => impact > 0.35)) {
    throw new Error("Projection over-concentrates impact on one world metric");
  }
  if (analysis.plausibility < 0.2) {
    throw new Error("Contribution is too implausible for the current world state");
  }
  return analysis;
}

function percentile(values: number[], p: number): number {
  const sorted = values.toSorted((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return Number(sorted[index]!.toFixed(4));
}

export function runMonteCarlo(
  proposal: string,
  analysis: ContributionAnalysis,
  samples: number,
): MonteCarloPreview {
  const random = new SeededRandom(
    [
      "kawkab-preview-v1",
      proposal.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(),
      analysis.plausibility.toFixed(8),
      JSON.stringify(analysis.effects),
    ].join("|"),
  );
  const byMetric = new Map<string, number[]>();
  let accepted = 0;
  let unstable = 0;

  for (let sample = 0; sample < samples; sample += 1) {
    const plausibilityDraw = random.next();
    if (plausibilityDraw <= analysis.plausibility) accepted += 1;
    let stabilityDelta = 0;
    for (const effect of analysis.effects) {
      const uncertainty = 0.65 + random.next() * 0.7;
      const projected = effect.delta * uncertainty;
      const values = byMetric.get(effect.metric) ?? [];
      values.push(projected);
      byMetric.set(effect.metric, values);
      if (effect.metric === "stability") stabilityDelta += projected;
    }
    if (stabilityDelta < -0.15) unstable += 1;
  }

  return {
    samples,
    acceptanceProbability: Number((accepted / samples).toFixed(4)),
    riskOfInstability: Number((unstable / samples).toFixed(4)),
    projectedEffects: [...byMetric.entries()].map(([metric, values]) => ({
      metric: metric as MonteCarloPreview["projectedEffects"][number]["metric"],
      p10: percentile(values, 0.1),
      median: percentile(values, 0.5),
      p90: percentile(values, 0.9),
    })),
  };
}

import type {
  ContributionAnalysis,
  PlanetRegion,
  WorldState,
} from "@planet/shared-types";
import {
  applyContribution,
  forecastContribution,
  replayEvents,
  simulateTick,
} from "@planet/simulation-models";

export type SimulationCommand =
  | { type: "ADVANCE_TICKS"; count: number; expectedVersion: number }
  | {
      type: "APPLY_CONTRIBUTION";
      contributionId: string;
      analysis: ContributionAnalysis;
      regionId: string;
      expectedVersion: number;
    };

export { applyContribution, forecastContribution, replayEvents, simulateTick };

export function previewContribution(
  state: WorldState,
  analysis: ContributionAnalysis,
  region: PlanetRegion,
) {
  return forecastContribution(state, analysis, region, 64);
}

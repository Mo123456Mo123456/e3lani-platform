import type { AiProvider } from "../adapters/ai-provider.js";
import type { EventBus } from "../adapters/event-bus.js";
import type { WorldRepository } from "../adapters/repository.js";
import type {
  CommitResult,
  ContributionAnalysis,
  ContributionInput,
  MonteCarloPreview,
} from "./contracts.js";
import { deriveAlgorithmicAnalysis } from "./effects.js";
import { AppError } from "./errors.js";
import {
  enforceGroundingAndBalance,
  moderateProposal,
  runMonteCarlo,
} from "./security.js";

export class ContributionService {
  constructor(
    private readonly repository: WorldRepository,
    private readonly ai: AiProvider,
    private readonly events: EventBus,
  ) {}

  async analyze(userId: string, input: ContributionInput): Promise<ContributionAnalysis> {
    const started = performance.now();
    const moderation = moderateProposal(input.proposal);
    if (!moderation.allowed) {
      await this.repository.recordAiAssessment({
        userId,
        planetId: input.planetId,
        proposal: input.proposal,
        provider: this.ai.status.provider,
        model: this.ai.status.model,
        moderation,
        latencyMs: Math.round(performance.now() - started),
        error: "Proposal rejected before provider invocation",
      });
      throw new AppError(
        422,
        "PROPOSAL_REJECTED",
        `Contribution failed safety checks: ${moderation.reasons.join(", ")}`,
      );
    }

    let analysis: ContributionAnalysis | undefined;
    try {
      const context = await this.repository.getGroundingContext(input.planetId);
      // Provider output is advisory and validated by its adapter. It is never
      // passed to the authoritative numeric projection.
      await this.ai.analyze(input.proposal, context);
      analysis = enforceGroundingAndBalance(
        deriveAlgorithmicAnalysis(input, context),
        context,
      );
      await this.repository.recordAiAssessment({
        userId,
        planetId: input.planetId,
        proposal: input.proposal,
        provider: this.ai.status.provider,
        model: this.ai.status.model,
        moderation,
        analysis,
        latencyMs: Math.round(performance.now() - started),
      });
      return analysis;
    } catch (error) {
      await this.repository.recordAiAssessment({
        userId,
        planetId: input.planetId,
        proposal: input.proposal,
        provider: this.ai.status.provider,
        model: this.ai.status.model,
        moderation,
        analysis,
        latencyMs: Math.round(performance.now() - started),
        error: error instanceof Error ? error.message : "Unknown AI error",
      });
      if (error instanceof AppError) throw error;
      throw new AppError(
        502,
        "AI_OUTPUT_INVALID",
        "The advisory provider or deterministic simulation projection was invalid",
      );
    }
  }

  async preview(
    userId: string,
    input: ContributionInput,
    samples: number,
  ): Promise<{ analysis: ContributionAnalysis; preview: MonteCarloPreview }> {
    const analysis = await this.analyze(userId, input);
    return {
      analysis,
      preview: runMonteCarlo(input.proposal, analysis, samples),
    };
  }

  async commit(
    userId: string,
    input: ContributionInput,
    idempotencyKey: string,
  ): Promise<{ analysis: ContributionAnalysis; result: CommitResult }> {
    const analysis = await this.analyze(userId, input);
    let result: CommitResult;
    try {
      result = await this.repository.commitContribution({
        userId,
        input,
        analysis,
        idempotencyKey,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "SIMULATION_PAUSED") {
        throw new AppError(409, "SIMULATION_PAUSED", "Simulation ticks are currently paused");
      }
      throw error;
    }
    if (!result.replayed) {
      await this.events.publish("world.delta", {
        type: "contribution.committed",
        planetId: input.planetId,
        tick: result.tick,
        payload: {
          contributionId: result.contributionId,
          snapshotId: result.snapshotId,
          events: result.events,
        },
        occurredAt: new Date().toISOString(),
      });
    }
    return { analysis, result };
  }
}

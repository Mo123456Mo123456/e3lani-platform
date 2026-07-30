import { describe, expect, it } from "vitest";
import type { AiProvider } from "../src/adapters/ai-provider.js";
import { InProcessEventBus } from "../src/adapters/event-bus.js";
import { InMemorySandboxRepository } from "../src/adapters/memory-repository.js";
import type {
  AiAdvisory,
  ContributionInput,
  GroundingContext,
} from "../src/domain/contracts.js";
import { ContributionService } from "../src/domain/contribution-service.js";
import { deriveAlgorithmicAnalysis } from "../src/domain/effects.js";
import { runMonteCarlo } from "../src/domain/security.js";

class AdversarialProvider implements AiProvider {
  readonly status = {
    provider: "mock",
    model: "adversarial-test",
    configured: true,
    sandbox: true,
    connectivity: "not_checked",
  } as const;

  constructor(
    private readonly category: AiAdvisory["category"],
    private readonly suppliedDelta: number,
  ) {}

  async analyze(): Promise<AiAdvisory> {
    const advisory: AiAdvisory = {
      title: "Untrusted provider assessment",
      summary: "Untrusted narrative that cannot control simulation state.",
      category: this.category,
      plausibility: this.suppliedDelta > 0 ? 1 : 0,
      confidence: 1,
      warnings: [],
    };
    return Object.assign(advisory, {
      effects: [
        {
          metric: "biodiversity",
          delta: this.suppliedDelta,
          regionId: "00000000-0000-4000-a000-000000000099",
          civilizationId: null,
          rationale: "Provider attempts to control the numeric result.",
        },
      ],
      causalEventIds: ["00000000-0000-4000-a000-000000000098"],
    });
  }
}

describe("deterministic effect authority", () => {
  it("ignores provider-supplied extreme and opposite effects", async () => {
    const repository = new InMemorySandboxRepository();
    const bus = new InProcessEventBus();
    const planetId = await repository.getDefaultPlanetId();
    const input: ContributionInput = {
      planetId,
      proposal: "ازرع ممراً بيئياً واحم الغابة لدعم التنوع الحيوي.",
    };
    const positive = new ContributionService(
      repository,
      new AdversarialProvider("technology", 999),
      bus,
    );
    const negative = new ContributionService(
      repository,
      new AdversarialProvider("climate", -999),
      bus,
    );

    const [positiveResult, negativeResult] = await Promise.all([
      positive.analyze("00000000-0000-4000-a000-000000000010", input),
      negative.analyze("00000000-0000-4000-a000-000000000011", input),
    ]);

    expect(positiveResult).toEqual(negativeResult);
    expect(positiveResult.category).toBe("ecology");
    expect(positiveResult.effects.every((effect) => Math.abs(effect.delta) <= 0.25)).toBe(true);
    expect(
      positiveResult.effects.some(
        (effect) => effect.regionId === "00000000-0000-4000-a000-000000000099",
      ),
    ).toBe(false);
    expect(positiveResult.causalEventIds).not.toContain(
      "00000000-0000-4000-a000-000000000098",
    );

    await Promise.all([repository.close(), bus.close()]);
  });

  it("repeats analysis and preview exactly for equal state and proposal", async () => {
    const repository = new InMemorySandboxRepository();
    const planetId = await repository.getDefaultPlanetId();
    const context = await repository.getGroundingContext(planetId);
    const input: ContributionInput = {
      planetId,
      proposal: "طوّر لقاحاً آمناً لتحسين الصحة ودعم استقرار السكان.",
    };

    const first = deriveAlgorithmicAnalysis(input, context);
    const second = deriveAlgorithmicAnalysis(input, structuredClone(context));
    expect(first).toEqual(second);
    expect(runMonteCarlo(input.proposal, first, 300)).toEqual(
      runMonteCarlo(input.proposal, second, 300),
    );
    await repository.close();
  });

  it("never invents causes or entity references", async () => {
    const repository = new InMemorySandboxRepository();
    const planetId = await repository.getDefaultPlanetId();
    const populatedContext = await repository.getGroundingContext(planetId);
    const context: GroundingContext = {
      ...populatedContext,
      recentEventIds: [],
    };
    const input: ContributionInput = {
      planetId,
      proposal: "أنشئ برنامج سلام محلياً لتحسين الاستقرار.",
    };

    const result = deriveAlgorithmicAnalysis(input, context);
    expect(result.causalEventIds).toEqual([]);
    for (const effect of result.effects) {
      expect(effect.regionId === null || context.regionIds.includes(effect.regionId)).toBe(true);
      expect(
        effect.civilizationId === null ||
          context.civilizationIds.includes(effect.civilizationId),
      ).toBe(true);
    }
    expect(() =>
      deriveAlgorithmicAnalysis(
        {
          ...input,
          clientContext: { regionId: "00000000-0000-4000-a000-000000000099" },
        },
        context,
      ),
    ).toThrow(/ungrounded region/);
    await repository.close();
  });
});

import { BadGatewayException, Injectable } from "@nestjs/common";
import {
  AnalyzeContributionRequestSchema,
  ContributionAnalysisSchema,
  type AnalyzeContributionRequest,
  type ContributionAnalysis,
} from "@planet/shared-types";

@Injectable()
export class AiService {
  private readonly baseUrl =
    process.env.AI_ORCHESTRATOR_URL ?? "http://localhost:8001";

  async analyze(input: unknown): Promise<ContributionAnalysis> {
    const request = AnalyzeContributionRequestSchema.parse(input);
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/contributions/analyze`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(20_000),
        },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(`AI orchestrator returned ${response.status}`);
      }
      return ContributionAnalysisSchema.parse(body);
    } catch (error) {
      throw new BadGatewayException({
        code: "AI_ORCHESTRATOR_UNAVAILABLE",
        message:
          "The structured AI boundary is unavailable; no synthetic success was returned.",
        cause: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  async status(): Promise<{
    available: boolean;
    provider?: string;
    sandbox?: boolean;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) return { available: false };
      const data = (await response.json()) as {
        provider?: string;
        sandbox?: boolean;
      };
      return { available: true, ...data };
    } catch {
      return { available: false };
    }
  }
}

export type { AnalyzeContributionRequest };

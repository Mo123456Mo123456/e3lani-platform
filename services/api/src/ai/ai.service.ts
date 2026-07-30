import { Injectable, Logger } from "@nestjs/common";
import { createProvider, moderateText, narrateEvents, parseContribution, type AiUsage, type ModerationOutput } from "@kawkab/ai";
import { checkBalance, expectedEffects } from "@kawkab/simulation";
import type { BalanceResult, ContributionCategory, Locale, NarrationFact, ParsedContribution, WorldEvent } from "@kawkab/shared-types";
import { PrismaService } from "../common/prisma.service.js";

export interface PreviewResult {
  parsed: ParsedContribution;
  balance: BalanceResult;
  expectedShortTerm: string[];
  expectedLongTerm: string[];
  sandbox: boolean;
  usage: AiUsage | null;
}

/**
 * Single gateway for AI work inside the API. Prefers the external
 * ai-orchestrator service when AI_ORCHESTRATOR_URL is set; otherwise runs the
 * same pipelines in-process. Every call is metered into the AIRequest table.
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private readonly orchestratorUrl = process.env.AI_ORCHESTRATOR_URL;
  private readonly localProvider = createProvider(process.env);

  constructor(private readonly prisma: PrismaService) {}

  get providerInfo(): { name: string; sandbox: boolean } {
    return { name: this.orchestratorUrl ? "orchestrator" : this.localProvider.name, sandbox: this.localProvider.sandbox };
  }

  async previewContribution(input: { text: string; category?: ContributionCategory; locale: Locale; userId?: string }): Promise<PreviewResult> {
    if (this.orchestratorUrl) {
      try {
        const res = await fetch(`${this.orchestratorUrl}/v1/preview`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: input.text, category: input.category, locale: input.locale }),
          signal: AbortSignal.timeout(35_000),
        });
        if (!res.ok) throw new Error(`orchestrator ${res.status}`);
        const data = (await res.json()) as PreviewResult & { usage: AiUsage };
        await this.meter(data.usage, input.userId);
        return data;
      } catch (err) {
        this.logger.warn(`orchestrator unreachable, falling back to in-process provider: ${String(err)}`);
      }
    }
    const outcome = await parseContribution(this.localProvider, { text: input.text, category: input.category, locale: input.locale });
    const balance = checkBalance(outcome.parsed);
    const effects = expectedEffects(balance.adjusted);
    await this.meter(outcome.usage, input.userId);
    return {
      parsed: outcome.parsed,
      balance,
      expectedShortTerm: effects.shortTerm,
      expectedLongTerm: effects.longTerm,
      sandbox: this.localProvider.sandbox,
      usage: outcome.usage,
    };
  }

  async narrate(input: { events: WorldEvent[]; facts: NarrationFact[]; locale: Locale; userId?: string }): Promise<{ text: string; grounded: boolean; sandbox: boolean }> {
    if (this.orchestratorUrl) {
      try {
        const res = await fetch(`${this.orchestratorUrl}/v1/narrate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(35_000),
        });
        if (!res.ok) throw new Error(`orchestrator ${res.status}`);
        const data = (await res.json()) as { text: string; grounded: boolean; usage: AiUsage | null; sandbox: boolean };
        if (data.usage) await this.meter(data.usage, input.userId);
        return { text: data.text, grounded: data.grounded, sandbox: data.sandbox };
      } catch (err) {
        this.logger.warn(`orchestrator narrate failed, local fallback: ${String(err)}`);
      }
    }
    const outcome = await narrateEvents(this.localProvider, input.events, input.facts, input.locale);
    if (outcome.usage) await this.meter(outcome.usage, input.userId);
    return { text: outcome.text, grounded: outcome.grounded, sandbox: this.localProvider.sandbox };
  }

  async moderate(text: string): Promise<ModerationOutput> {
    return moderateText(text);
  }

  private async meter(usage: AiUsage | null, userId?: string): Promise<void> {
    if (!usage || !process.env.DATABASE_URL) return;
    await this.prisma.aIRequest
      .create({
        data: {
          userId: userId ?? null,
          provider: usage.provider,
          model: usage.model,
          operation: usage.operation,
          tokensIn: usage.tokensIn,
          tokensOut: usage.tokensOut,
          costUsd: usage.costUsd,
          latencyMs: usage.latencyMs,
          sandbox: usage.sandbox,
        },
      })
      .catch((err) => this.logger.warn(`metering failed: ${String(err)}`));
  }
}

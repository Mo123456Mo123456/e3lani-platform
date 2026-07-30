import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";

/**
 * Client for the AI orchestrator with per-call accounting (AIRequest
 * rows power the admin cost dashboard). Mock/sandbox calls cost $0.
 */
@Injectable()
export class AiService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  private baseUrl(): string {
    return process.env.AI_ORCHESTRATOR_URL ?? "http://localhost:8002";
  }

  private async call<T>(
    path: string,
    body: unknown,
    meta: { userId?: string; contributionId?: string; kind: string },
  ): Promise<T> {
    const started = Date.now();
    let status = "ok";
    let payload: Record<string, unknown> | null = null;
    try {
      const res = await fetch(`${this.baseUrl()}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        status = "error";
        throw new ServiceUnavailableException({
          error: "orchestrator_error",
          status: res.status,
          detail: payload,
        });
      }
      return payload as T;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      status = "error";
      throw new ServiceUnavailableException({ error: "orchestrator_unreachable", detail: (err as Error).message });
    } finally {
      const latencyMs = Date.now() - started;
      const provider = (payload?.provider as string) ?? "unknown";
      const sandbox = payload?.sandbox !== false;
      const tokensIn = Math.ceil(JSON.stringify(body).length / 4);
      const tokensOut = payload ? Math.ceil(JSON.stringify(payload).length / 4) : 0;
      const cost = estimateCostUsd(provider, sandbox, tokensIn, tokensOut);
      await this.logRequest({
        userId: meta.userId,
        contributionId: meta.contributionId,
        provider,
        kind: meta.kind,
        sandbox,
        tokensIn,
        tokensOut,
        costUsd: cost,
        latencyMs,
        status: status === "ok" && sandbox && provider === "mock" ? "fallback" : status,
        detail: { path },
      }).catch(() => undefined);
    }
  }

  async logRequest(entry: {
    userId?: string;
    contributionId?: string;
    provider: string;
    kind: string;
    sandbox: boolean;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    latencyMs: number;
    status: string;
    detail: Record<string, unknown>;
  }): Promise<void> {
    await this.db
      .insertInto("ai_requests")
      .values({
        user_id: entry.userId ?? null,
        contribution_id: entry.contributionId ?? null,
        provider: entry.provider,
        kind: entry.kind,
        sandbox: entry.sandbox,
        tokens_in: entry.tokensIn,
        tokens_out: entry.tokensOut,
        cost_usd: entry.costUsd,
        latency_ms: entry.latencyMs,
        status: entry.status,
        detail: entry.detail,
      })
      .execute();
  }

  analyze(text: string, locale: string, category: string | undefined, meta: { userId?: string; contributionId?: string }) {
    return this.call<{
      moderation: { status: string; reasons: string[] };
      contribution: Record<string, unknown>;
      balance: Record<string, unknown> | null;
      graph: Record<string, unknown> | null;
      provider: string;
      sandbox: boolean;
    }>("/analyze", { text, locale, category }, { ...meta, kind: "parse" });
  }

  narrate(events: Array<Record<string, unknown>>, locale: string, meta: { userId?: string; contributionId?: string }) {
    return this.call<{
      text: string;
      referencedEventIds: string[];
      provider: string;
      sandbox: boolean;
      validated: boolean;
    }>("/narrate", { events, locale }, { ...meta, kind: "narrate" });
  }

  async providerStatus() {
    try {
      const res = await fetch(`${this.baseUrl()}/providers`, { signal: AbortSignal.timeout(5000) });
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return { error: "unreachable" };
    }
  }
}

const COST_PER_1K: Record<string, { in: number; out: number }> = {
  openai: { in: 0.00015, out: 0.0006 },
  anthropic: { in: 0.0008, out: 0.004 },
  gemini: { in: 0.000075, out: 0.0003 },
};

export function estimateCostUsd(provider: string, sandbox: boolean, tokensIn: number, tokensOut: number): number {
  if (sandbox || provider === "mock") return 0;
  const rates = COST_PER_1K[provider];
  if (!rates) return 0;
  return (tokensIn / 1000) * rates.in + (tokensOut / 1000) * rates.out;
}

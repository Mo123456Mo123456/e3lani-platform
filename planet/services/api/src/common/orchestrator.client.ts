import { Injectable } from "@nestjs/common";
import { config } from "../config.js";

/** Client for the ai-orchestrator service (analysis, balance, moderation, narrative). */
@Injectable()
export class OrchestratorClient {
  private base = config.orchestratorUrl;

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = new Error((data["error"] as string) ?? `orchestrator_http_${res.status}`);
      (err as { status?: number; detail?: unknown }).status = res.status;
      (err as { status?: number; detail?: unknown }).detail = data;
      throw err;
    }
    return data as T;
  }

  analyze(input: { category: string; text: string; locale: string; userId: string }) {
    return this.call<{ analysis: unknown; balance: unknown; moderation: { flags: string[] } }>(
      "POST",
      "/analyze",
      input,
    );
  }

  narrate(input: { locale: string; facts: unknown[] }) {
    return this.call<{ text: string; llmGenerated: boolean; provider: string }>("POST", "/narrate", input);
  }

  providers() {
    return this.call<{ active: string; providers: { name: string; live: boolean; sandbox: boolean }[] }>("GET", "/providers");
  }

  async healthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

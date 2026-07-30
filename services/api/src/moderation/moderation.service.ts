import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";

/**
 * Local fast-path moderation mirror (the orchestrator re-checks with the
 * full pipeline during analyze). Static rules only — user text is data,
 * never executed, never interpolated into prompts server-side.
 */
const BANNED = [
  /كيفية صنع (قنبلة|سلاح|متفجر)/i,
  /\bhow to make (a )?(bomb|weapon|explosive)\b/i,
  /\b(kill all|exterminate)\s+\w+/i,
];

const INJECTION = [
  /تجاهل (جميع )?(التعليمات|الأوامر)/,
  /\b(ignore|disregard)\b.{0,40}\b(instructions?|rules?|prompts?)\b/is,
  /\b(system prompt|developer mode|jailbreak)\b/i,
  /\{\{.*\}\}/s,
  /<\s*\/?\s*(script|iframe|img|svg)/i,
  /javascript:/i,
  /\b(DROP|DELETE|TRUNCATE)\s+TABLE\b/i,
  /\bSELECT\b.+\bFROM\b/i,
];

export interface ModerationVerdict {
  status: "allow" | "flag" | "block";
  reasons: string[];
}

@Injectable()
export class ModerationService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  check(text: string): ModerationVerdict {
    if (!text || !text.trim()) return { status: "block", reasons: ["empty_text"] };
    if (text.length > 1200) return { status: "block", reasons: ["text_too_long"] };
    if (BANNED.some((p) => p.test(text))) return { status: "block", reasons: ["banned_content"] };
    if (INJECTION.some((p) => p.test(text))) return { status: "block", reasons: ["prompt_injection"] };
    const words = text.split(/\s+/);
    if (words.length > 12 && new Set(words).size / words.length < 0.4) {
      return { status: "block", reasons: ["repetitive_spam"] };
    }
    return { status: "allow", reasons: [] };
  }

  async record(userId: string | null, kind: string, text: string, verdict: ModerationVerdict): Promise<string> {
    const row = await this.db
      .insertInto("moderation_results")
      .values({
        user_id: userId,
        kind,
        text: text.slice(0, 2000),
        status: verdict.status,
        reasons: verdict.reasons,
        review_status: verdict.status === "flag" ? "pending" : "none",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async queue() {
    const rows = await this.db
      .selectFrom("moderation_results")
      .innerJoin("users", "users.id", "moderation_results.user_id")
      .select([
        "moderation_results.id",
        "moderation_results.user_id",
        "moderation_results.text",
        "moderation_results.status",
        "moderation_results.reasons",
        "moderation_results.created_at",
        "users.email as user_email",
      ])
      .where("moderation_results.review_status", "=", "pending")
      .orderBy("moderation_results.created_at", "desc")
      .limit(100)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email ?? "",
      text: r.text,
      status: r.status,
      reasons: r.reasons as string[],
      createdAt: r.created_at.toISOString(),
    }));
  }

  async review(id: string, reviewerId: string, decision: "approve" | "reject", note?: string): Promise<void> {
    await this.db
      .updateTable("moderation_results")
      .set({
        review_status: decision === "approve" ? "approved" : "rejected",
        reviewer_id: reviewerId,
        review_note: note ?? null,
        reviewed_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }
}

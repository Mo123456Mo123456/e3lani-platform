import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";

export interface AuditEntry {
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
}

/** Append-only audit trail for security and admin actions. */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.db
      .insertInto("audit_logs")
      .values({
        actor_id: entry.actorId,
        actor_email: entry.actorEmail,
        action: entry.action,
        target_type: entry.targetType ?? null,
        target_id: entry.targetId ?? null,
        detail: entry.detail ?? {},
        ip: entry.ip ?? null,
      })
      .execute();
  }
}

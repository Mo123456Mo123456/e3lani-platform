import { query, type Tx } from '../db/pool.js';
import { actorLabel, type Ctx } from './context.js';

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

interface Runner {
  query: (text: string, params?: readonly unknown[]) => Promise<unknown>;
}

const SQL = `
  INSERT INTO audit_logs
    (company_id, actor_user_id, actor_device_id, actor_label, action, entity, entity_id,
     before, after, ip, user_agent)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
`;

/**
 * تسجيل عملية في سجل التدقيق. لا يُسقط الطلب أبدًا إذا فشل التسجيل نفسه،
 * لكنه يطبع الخطأ حتى لا يمر بصمت.
 */
export async function audit(ctx: Ctx, input: AuditInput, tx?: Tx): Promise<void> {
  const runner: Runner = tx ?? { query: (t, p) => query(t, p ?? []) };
  const actor = ctx.actor;
  const params = [
    ctx.companyId,
    actor?.kind === 'user' ? actor.id : null,
    actor?.kind === 'device' ? actor.id : null,
    actorLabel(actor),
    input.action,
    input.entity,
    input.entityId ?? null,
    input.before === undefined ? null : JSON.stringify(input.before),
    input.after === undefined ? null : JSON.stringify(input.after),
    ctx.meta.ip ?? null,
    ctx.meta.userAgent ?? null,
  ];
  try {
    await runner.query(SQL, params);
  } catch (err) {
    console.error(
      '[VERO] تعذّر كتابة سجل التدقيق:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** يزيل الحقول الحساسة قبل تخزينها في سجل التدقيق. */
export function redact<T extends Record<string, unknown>>(obj: T | null | undefined): Partial<T> {
  if (!obj) return {};
  const hidden = new Set([
    'password',
    'password_hash',
    'password_salt',
    'token_hash',
    'deviceToken',
    'accessToken',
    'refreshToken',
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (hidden.has(k)) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

import { one, rows } from '../../db/pool.js';

export interface AuditQuery {
  action?: string;
  entity?: string;
  entityId?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditDto {
  id: string;
  actorLabel: string | null;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export async function listAudit(
  companyId: string,
  q: AuditQuery,
): Promise<{ items: AuditDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, q.pageSize ?? 50));
  const where = ['a.company_id = $1'];
  const params: unknown[] = [companyId];
  let p = 1;

  if (q.action) {
    where.push(`a.action = $${++p}`);
    params.push(q.action);
  }
  if (q.entity) {
    where.push(`a.entity = $${++p}`);
    params.push(q.entity);
  }
  if (q.entityId) {
    where.push(`a.entity_id = $${++p}`);
    params.push(q.entityId);
  }
  if (q.actorUserId) {
    where.push(`a.actor_user_id = $${++p}`);
    params.push(q.actorUserId);
  }
  if (q.from) {
    where.push(`a.created_at >= $${++p}::timestamptz`);
    params.push(q.from);
  }
  if (q.to) {
    where.push(`a.created_at <= $${++p}::timestamptz`);
    params.push(q.to);
  }

  const clause = `WHERE ${where.join(' AND ')}`;
  const totalRow = await one<{ count: number }>(
    `SELECT count(*)::int AS count FROM audit_logs a ${clause}`,
    params,
  );

  const list = await rows<{
    id: string;
    actor_label: string | null;
    actor_user_id: string | null;
    actor_name: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    before: unknown;
    after: unknown;
    ip: string | null;
    user_agent: string | null;
    created_at: Date;
  }>(
    `SELECT a.id, a.actor_label, a.actor_user_id, u.full_name AS actor_name,
            a.action, a.entity, a.entity_id, a.before, a.after, a.ip, a.user_agent, a.created_at
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
       ${clause}
      ORDER BY a.created_at DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params,
  );

  return {
    items: list.map((r) => ({
      id: r.id,
      actorLabel: r.actor_label,
      actorUserId: r.actor_user_id,
      actorName: r.actor_name,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      before: r.before,
      after: r.after,
      ip: r.ip,
      userAgent: r.user_agent,
      createdAt: r.created_at.toISOString(),
    })),
    total: totalRow?.count ?? 0,
    page,
    pageSize,
  };
}

export async function auditActions(companyId: string): Promise<string[]> {
  const list = await rows<{ action: string }>(
    'SELECT DISTINCT action FROM audit_logs WHERE company_id = $1 ORDER BY action',
    [companyId],
  );
  return list.map((r) => r.action);
}

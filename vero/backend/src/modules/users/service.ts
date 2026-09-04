import { audit } from '../../core/audit.js';
import type { Ctx, Role } from '../../core/context.js';
import { hashPassword } from '../../core/crypto.js';
import { AppError, conflict, notFound } from '../../core/errors.js';
import { one, query, rows } from '../../db/pool.js';
import { toUserDto, type UserDto, type UserRow } from '../auth/service.js';

const UNIQUE_VIOLATION = '23505';

export async function listUsers(companyId: string): Promise<UserDto[]> {
  const list = await rows<UserRow>(
    'SELECT * FROM users WHERE company_id = $1 ORDER BY created_at',
    [companyId],
  );
  return list.map(toUserDto);
}

export interface CreateUserInput {
  fullName: string;
  username: string;
  email?: string | null;
  password: string;
  role: Role;
}

export async function createUser(ctx: Ctx, input: CreateUserInput): Promise<UserDto> {
  if (input.password.length < 8) {
    throw new AppError('VALIDATION_FAILED', 'كلمة المرور يجب ألا تقل عن 8 أحرف');
  }
  const { hash, salt } = await hashPassword(input.password);
  let row: UserRow | null;
  try {
    row = await one<UserRow>(
      `INSERT INTO users (company_id, full_name, username, email, password_hash, password_salt, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [ctx.companyId, input.fullName, input.username, input.email ?? null, hash, salt, input.role],
    );
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict('اسم المستخدم مستخدم مسبقًا');
    }
    throw err;
  }
  if (!row) throw new AppError('INTERNAL', 'تعذّر إنشاء المستخدم');
  await audit(ctx, {
    action: 'user.create',
    entity: 'user',
    entityId: row.id,
    after: toUserDto(row),
  });
  return toUserDto(row);
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string | null;
  role?: Role;
  isActive?: boolean;
  password?: string;
}

export async function updateUser(
  ctx: Ctx,
  id: string,
  input: UpdateUserInput,
): Promise<UserDto> {
  const before = await one<UserRow>('SELECT * FROM users WHERE id = $1 AND company_id = $2', [
    id,
    ctx.companyId,
  ]);
  if (!before) throw notFound('المستخدم غير موجود');

  // حماية: لا يمكن إزالة آخر مدير نشط من النظام
  if ((input.role && input.role !== 'ADMIN') || input.isActive === false) {
    if (before.role === 'ADMIN') {
      await assertNotLastActiveAdmin(ctx.companyId, id);
    }
  }

  let hash: string | null = null;
  let salt: string | null = null;
  if (input.password) {
    if (input.password.length < 8) {
      throw new AppError('VALIDATION_FAILED', 'كلمة المرور يجب ألا تقل عن 8 أحرف');
    }
    const h = await hashPassword(input.password);
    hash = h.hash;
    salt = h.salt;
  }

  const after = await one<UserRow>(
    `UPDATE users SET
       full_name     = COALESCE($3, full_name),
       email         = COALESCE($4, email),
       role          = COALESCE($5, role),
       is_active     = COALESCE($6, is_active),
       password_hash = COALESCE($7, password_hash),
       password_salt = COALESCE($8, password_salt),
       updated_at    = now()
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [
      id,
      ctx.companyId,
      input.fullName ?? null,
      input.email ?? null,
      input.role ?? null,
      input.isActive ?? null,
      hash,
      salt,
    ],
  );
  if (!after) throw notFound('المستخدم غير موجود');

  if (input.password) {
    // إبطال كل الجلسات عند تغيير كلمة المرور
    await query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [id],
    );
  }

  await audit(ctx, {
    action: 'user.update',
    entity: 'user',
    entityId: id,
    before: toUserDto(before),
    after: toUserDto(after),
  });
  return toUserDto(after);
}

export async function deleteUser(ctx: Ctx, id: string): Promise<void> {
  const before = await one<UserRow>('SELECT * FROM users WHERE id = $1 AND company_id = $2', [
    id,
    ctx.companyId,
  ]);
  if (!before) throw notFound('المستخدم غير موجود');
  if (ctx.actor?.kind === 'user' && ctx.actor.id === id) {
    throw conflict('لا يمكن حذف حسابك الحالي');
  }
  if (before.role === 'ADMIN') await assertNotLastActiveAdmin(ctx.companyId, id);

  await query('DELETE FROM users WHERE id = $1 AND company_id = $2', [id, ctx.companyId]);
  await audit(ctx, {
    action: 'user.delete',
    entity: 'user',
    entityId: id,
    before: toUserDto(before),
  });
}

async function assertNotLastActiveAdmin(companyId: string, excludeId: string): Promise<void> {
  const res = await one<{ count: number }>(
    `SELECT count(*)::int AS count FROM users
     WHERE company_id = $1 AND role = 'ADMIN' AND is_active AND id <> $2`,
    [companyId, excludeId],
  );
  if (!res || res.count === 0) {
    throw conflict('لا يمكن تعطيل أو حذف آخر مدير نشط في النظام');
  }
}

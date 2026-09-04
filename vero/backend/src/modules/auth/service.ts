import { audit } from '../../core/audit.js';
import type { Ctx, Role, UserActor } from '../../core/context.js';
import {
  hashPassword,
  randomToken,
  sha256Hex,
  signJwt,
  verifyPassword,
} from '../../core/crypto.js';
import { AppError } from '../../core/errors.js';
import { env } from '../../config/env.js';
import { one, query } from '../../db/pool.js';

export interface UserRow {
  id: string;
  company_id: string;
  full_name: string;
  username: string;
  email: string | null;
  password_hash: string;
  password_salt: string;
  role: Role;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

export interface UserDto {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export const toUserDto = (r: UserRow): UserDto => ({
  id: r.id,
  fullName: r.full_name,
  username: r.username,
  email: r.email,
  role: r.role,
  isActive: r.is_active,
  lastLoginAt: r.last_login_at ? r.last_login_at.toISOString() : null,
  createdAt: r.created_at.toISOString(),
});

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  user: UserDto;
}

export async function login(
  username: string,
  password: string,
  meta: { ip?: string; userAgent?: string },
): Promise<LoginResult> {
  const user = await one<UserRow>('SELECT * FROM users WHERE lower(username) = lower($1)', [
    username,
  ]);

  // نفس الرسالة ونفس التكلفة الزمنية تقريبًا سواء وُجد المستخدم أم لا
  if (!user) {
    await hashPassword(password); // يستهلك وقتًا مشابهًا لمنع تعداد المستخدمين
    throw new AppError('INVALID_CREDENTIALS', 'اسم المستخدم أو كلمة المرور غير صحيحة');
  }

  const ok = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!ok) {
    throw new AppError('INVALID_CREDENTIALS', 'اسم المستخدم أو كلمة المرور غير صحيحة');
  }
  if (!user.is_active) {
    throw new AppError('FORBIDDEN', 'الحساب موقوف. راجع مدير النظام.');
  }

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

  const accessToken = signJwt({
    sub: user.id,
    cid: user.company_id,
    role: user.role,
    typ: 'access',
  });
  const refreshToken = await issueRefreshToken(user.id);

  const ctx: Ctx = {
    companyId: user.company_id,
    actor: toActor(user),
    meta,
  };
  await audit(ctx, { action: 'auth.login', entity: 'user', entityId: user.id });

  return {
    accessToken,
    refreshToken,
    expiresInSec: env.accessTokenTtlSec,
    user: toUserDto(user),
  };
}

export function toActor(user: UserRow): UserActor {
  return {
    kind: 'user',
    id: user.id,
    companyId: user.company_id,
    role: user.role,
    fullName: user.full_name,
    username: user.username,
  };
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + env.refreshTokenTtlSec * 1000);
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [userId, sha256Hex(token), expires],
  );
  return token;
}

export async function refresh(refreshToken: string): Promise<LoginResult> {
  const hash = sha256Hex(refreshToken);
  const row = await one<{ id: string; user_id: string; expires_at: Date; revoked_at: Date | null }>(
    'SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1',
    [hash],
  );
  if (!row || row.revoked_at || row.expires_at.getTime() < Date.now()) {
    throw new AppError('INVALID_TOKEN', 'رمز التجديد غير صالح أو منتهي');
  }
  const user = await one<UserRow>('SELECT * FROM users WHERE id = $1', [row.user_id]);
  if (!user || !user.is_active) {
    throw new AppError('FORBIDDEN', 'الحساب غير متاح');
  }

  // تدوير الرمز: كل تجديد يُبطل الرمز السابق
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id]);
  const newRefresh = await issueRefreshToken(user.id);
  const accessToken = signJwt({
    sub: user.id,
    cid: user.company_id,
    role: user.role,
    typ: 'access',
  });

  return {
    accessToken,
    refreshToken: newRefresh,
    expiresInSec: env.accessTokenTtlSec,
    user: toUserDto(user),
  };
}

export async function logout(ctx: Ctx, refreshToken?: string): Promise<void> {
  if (refreshToken) {
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [
      sha256Hex(refreshToken),
    ]);
  } else if (ctx.actor?.kind === 'user') {
    await query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [ctx.actor.id],
    );
  }
  await audit(ctx, { action: 'auth.logout', entity: 'user', entityId: ctx.actor?.id ?? null });
}

export async function findUserById(id: string): Promise<UserRow | null> {
  return one<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
}

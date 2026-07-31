import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission } from '@e3lani/config';

export const IS_PUBLIC_KEY = 'e3lani:isPublic';
export const OPTIONAL_AUTH_KEY = 'e3lani:optionalAuth';
export const ADMIN_ONLY_KEY = 'e3lani:adminOnly';
export const PERMISSIONS_KEY = 'e3lani:permissions';
export const RATE_LIMIT_KEY = 'e3lani:rateLimit';

/** مسار عام لا يتطلب مصادقة. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** مسار يعمل مع أو بدون مستخدم مسجّل (مثل الموجز والبحث). */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);

/** مسار يخص لوحة الإدارة فقط. */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);

/** الصلاحيات المطلوبة داخل لوحة الإدارة. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  /** المفتاح: ip | user | phone */
  by?: 'ip' | 'user';
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

export interface AuthUser {
  id: string;
  phone: string;
  accountType: string;
  status: string;
  profileCompleted: boolean;
}

export interface AuthAdmin {
  id: string;
  email: string;
  role: string;
  permissions: Permission[];
}

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest();
  return request.user as AuthUser | undefined;
});

export const CurrentAdmin = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest();
  return request.admin as AuthAdmin | undefined;
});

export const ClientMeta = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest();
  return {
    ip: (request.headers['x-forwarded-for']?.split(',')[0] ?? request.ip ?? '').trim(),
    userAgent: request.headers['user-agent'] ?? null,
  };
});

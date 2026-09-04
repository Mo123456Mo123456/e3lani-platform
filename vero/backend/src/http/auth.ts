import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../core/errors.js';
import { verifyJwt } from '../core/crypto.js';
import { roleAtLeast, type Ctx, type DeviceActor, type Role } from '../core/context.js';
import { findUserById, toActor } from '../modules/auth/service.js';
import { resolveDeviceToken, touchDevice } from '../modules/devices/service.js';
import { requireCompany } from '../modules/company/service.js';

declare module 'fastify' {
  interface FastifyRequest {
    ctx?: Ctx;
    deviceTimezone?: string;
  }
}

function requestMeta(req: FastifyRequest) {
  return {
    ip: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

function bearer(req: FastifyRequest, scheme: 'Bearer' | 'Device'): string | null {
  const h = req.headers.authorization;
  if (typeof h !== 'string') return null;
  const prefix = `${scheme} `;
  if (!h.startsWith(prefix)) return null;
  const value = h.slice(prefix.length).trim();
  return value.length > 0 ? value : null;
}

/** يتطلّب مستخدم لوحة إدارة بدور لا يقل عن `min`. */
export function requireUser(min: Role = 'VIEWER') {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = bearer(req, 'Bearer');
    if (!token) throw new AppError('UNAUTHORIZED', 'مطلوب تسجيل الدخول');

    const payload = verifyJwt(token);
    const user = await findUserById(payload.sub);
    if (!user) throw new AppError('UNAUTHORIZED', 'الحساب غير موجود');
    if (!user.is_active) throw new AppError('FORBIDDEN', 'الحساب موقوف');

    // الدور يُقرأ من قاعدة البيانات لا من الرمز، فتغيير الصلاحية يسري فورًا
    if (!roleAtLeast(user.role, min)) {
      throw new AppError('FORBIDDEN', 'صلاحيتك لا تسمح بهذا الإجراء', {
        required: min,
        actual: user.role,
      });
    }

    req.ctx = {
      companyId: user.company_id,
      actor: toActor(user),
      meta: requestMeta(req),
    };
  };
}

/** يتطلّب جهاز عامل مُفعَّل ومرتبط. */
export async function requireDevice(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = bearer(req, 'Device');
  if (!token) throw new AppError('UNAUTHORIZED', 'الجهاز غير مُفعَّل');
  const device = await resolveDeviceToken(token);
  req.ctx = {
    companyId: device.companyId,
    actor: device,
    meta: requestMeta(req),
  };
  req.deviceTimezone = device.companyTimezone;
  void touchDevice(device.id);
}

export function ctxOf(req: FastifyRequest): Ctx {
  if (!req.ctx) throw new AppError('UNAUTHORIZED', 'سياق الطلب غير مُهيأ');
  return req.ctx;
}

export function deviceOf(req: FastifyRequest): DeviceActor {
  const ctx = ctxOf(req);
  if (ctx.actor?.kind !== 'device') throw new AppError('FORBIDDEN', 'هذا المسار لأجهزة العمال فقط');
  return ctx.actor;
}

export function anonCtx(req: FastifyRequest, companyId: string): Ctx {
  return { companyId, actor: null, meta: requestMeta(req) };
}

/** يتأكد أن النظام مُعدّ ويعيد سياقًا بلا فاعل (لمسارات عامة تحتاج معرّف الشركة). */
export async function publicCtx(req: FastifyRequest): Promise<Ctx> {
  const company = await requireCompany();
  return anonCtx(req, company.id);
}

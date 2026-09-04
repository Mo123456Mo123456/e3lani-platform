import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../core/errors.js';
import { todayServiceDay } from '../core/time.js';
import { one } from '../db/pool.js';
import * as auditSvc from '../modules/audit/service.js';
import * as authSvc from '../modules/auth/service.js';
import * as backupSvc from '../modules/backups/service.js';
import * as binSvc from '../modules/bins/service.js';
import * as companySvc from '../modules/company/service.js';
import * as dashSvc from '../modules/dashboard/service.js';
import * as deviceSvc from '../modules/devices/service.js';
import * as fleetSvc from '../modules/fleet/service.js';
import * as qrSvc from '../modules/qr/service.js';
import * as reportRender from '../modules/reports/render.js';
import * as reportSvc from '../modules/reports/service.js';
import * as routeSvc from '../modules/routes/service.js';
import * as scanSvc from '../modules/scans/service.js';
import * as setupSvc from '../modules/setup/service.js';
import * as userSvc from '../modules/users/service.js';
import { ctxOf, deviceOf, requireDevice, requireUser } from './auth.js';

// ─────────────────────────── مخططات التحقق ───────────────────────────

const uuid = z.string().uuid('معرّف غير صالح');
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'الصيغة المطلوبة YYYY-MM-DD');
const lat = z.number().min(-90).max(90);
const lon = z.number().min(-180).max(180);

const setupSchema = z.object({
  company: z.object({
    name: z.string().min(2).max(160),
    city: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
    email: z.string().email().max(160).optional(),
    address: z.string().max(400).optional(),
    defaultGpsRadiusM: z.number().int().min(5).max(5000),
    timezone: z.string().max(64).optional(),
  }),
  admin: z.object({
    fullName: z.string().min(2).max(120),
    username: z.string().min(3).max(60).regex(/^[A-Za-z0-9._-]+$/, 'أحرف إنجليزية وأرقام فقط'),
    email: z.string().email().max(160).optional(),
    password: z.string().min(8).max(200),
  }),
});

const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
});

const binInputSchema = z.object({
  publicId: z.string().max(40).optional(),
  name: z.string().max(200).nullish(),
  sector: z.string().max(120).nullish(),
  area: z.string().max(120).nullish(),
  address: z.string().max(400).nullish(),
  lat,
  lon,
  gpsRadiusM: z.number().int().min(5).max(5000).nullish(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  notes: z.string().max(1000).nullish(),
});

const scanInputSchema = z.object({
  clientUuid: uuid,
  token: z.string().min(8).max(400),
  lat,
  lon,
  accuracyM: z.number().min(0).max(100_000).nullish(),
  scannedAt: z.string().datetime({ offset: true }),
  offline: z.boolean().optional(),
  sessionId: uuid.nullish(),
});

const routePointSchema = z.object({
  clientUuid: uuid,
  lat,
  lon,
  recordedAt: z.string().datetime({ offset: true }),
  speedMps: z.number().min(0).max(200).nullish(),
  accuracyM: z.number().min(0).max(100_000).nullish(),
});

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const res = schema.safeParse(data);
  if (!res.success) {
    throw new AppError('VALIDATION_FAILED', 'بيانات الطلب غير صالحة', {
      issues: res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return res.data;
}

const intOr = (v: unknown, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

async function companyDay(): Promise<{ companyId: string; day: string; timezone: string }> {
  const c = await companySvc.requireCompany();
  return { companyId: c.id, day: todayServiceDay(c.timezone), timezone: c.timezone };
}

// ─────────────────────────── التسجيل ───────────────────────────

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  const admin = { preHandler: requireUser('VIEWER') };
  const supervisor = { preHandler: requireUser('SUPERVISOR') };
  const adminOnly = { preHandler: requireUser('ADMIN') };
  const device = { preHandler: requireDevice };

  // ══════════ الصحة والإعداد ══════════

  app.get('/health', async (_req, reply) => {
    try {
      const r = await one<{ v: string }>('SELECT PostGIS_Lib_Version() AS v');
      const setup = await setupSvc.getSetupStatus();
      return {
        status: 'ok',
        db: 'ok',
        postgis: r?.v ?? 'unknown',
        version: env.version,
        setupCompleted: setup.setupCompleted,
      };
    } catch (err) {
      // فشل قاعدة البيانات يُبلَّغ صراحة — لا بيانات بديلة ولا نجاح وهمي
      return reply.status(503).send({
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'قاعدة البيانات غير متاحة',
          details: { reason: err instanceof Error ? err.message : String(err) },
        },
      });
    }
  });

  app.get('/v1/setup/status', async () => setupSvc.getSetupStatus());

  app.post('/v1/setup', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const body = parse(setupSchema, req.body);
    const res = await setupSvc.runSetup(body, {
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] ?? ''),
    });
    const login = await authSvc.login(body.admin.username, body.admin.password, { ip: req.ip });
    return reply.status(201).send({
      company: companySvc.toCompanyDto(res.company),
      ...login,
    });
  });

  // ══════════ المصادقة ══════════

  app.post(
    '/v1/auth/login',
    { config: { rateLimit: { max: env.authRateLimitMax, timeWindow: '5 minutes' } } },
    async (req) => {
      const body = parse(loginSchema, req.body);
      return authSvc.login(body.username, body.password, {
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
      });
    },
  );

  app.post('/v1/auth/refresh', async (req) => {
    const body = parse(z.object({ refreshToken: z.string().min(10) }), req.body);
    return authSvc.refresh(body.refreshToken);
  });

  app.post('/v1/auth/logout', admin, async (req) => {
    const body = parse(
      z.object({ refreshToken: z.string().optional() }),
      req.body ?? {},
    );
    await authSvc.logout(ctxOf(req), body.refreshToken);
    return { ok: true };
  });

  app.get('/v1/auth/me', admin, async (req) => {
    const ctx = ctxOf(req);
    if (ctx.actor?.kind !== 'user') throw new AppError('FORBIDDEN', 'غير متاح');
    const user = await authSvc.findUserById(ctx.actor.id);
    if (!user) throw new AppError('NOT_FOUND', 'المستخدم غير موجود');
    const company = await companySvc.requireCompany();
    return { user: authSvc.toUserDto(user), company: companySvc.toCompanyDto(company) };
  });

  // ══════════ هوية الشركة والإعدادات ══════════

  app.get('/v1/company', admin, async () =>
    companySvc.toCompanyDto(await companySvc.requireCompany()),
  );

  app.patch('/v1/company', adminOnly, async (req) => {
    const body = parse(
      z.object({
        name: z.string().min(2).max(160).optional(),
        city: z.string().max(120).nullish(),
        phone: z.string().max(40).nullish(),
        email: z.string().email().max(160).nullish(),
        address: z.string().max(400).nullish(),
        defaultGpsRadiusM: z.number().int().min(5).max(5000).optional(),
        timezone: z.string().max(64).optional(),
      }),
      req.body,
    );
    return companySvc.toCompanyDto(await companySvc.updateCompany(ctxOf(req), body));
  });

  app.post('/v1/company/logo', adminOnly, async (req) => {
    const file = await (req as FastifyRequest & { file: () => Promise<any> }).file();
    if (!file) throw new AppError('BAD_REQUEST', 'لم يُرفع أي ملف');
    const ext = extname(String(file.filename ?? '')).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
      throw new AppError('VALIDATION_FAILED', 'الشعار يجب أن يكون PNG أو JPG');
    }
    const buffer = await file.toBuffer();
    if (buffer.length > 3 * 1024 * 1024) {
      throw new AppError('VALIDATION_FAILED', 'حجم الشعار يتجاوز 3 ميجابايت');
    }
    const dir = resolve(env.storageDir, 'branding');
    await mkdir(dir, { recursive: true });
    const target = join(dir, `logo${ext}`);
    await writeFile(target, buffer);
    const updated = await companySvc.setCompanyLogo(ctxOf(req), target);
    return companySvc.toCompanyDto(updated);
  });

  app.get('/v1/company/logo', async (_req, reply) => {
    const company = await companySvc.requireCompany();
    if (!company.logo_path || !existsSync(company.logo_path)) {
      throw new AppError('NOT_FOUND', 'لا يوجد شعار محفوظ');
    }
    const ext = extname(company.logo_path).toLowerCase();
    reply.type(ext === '.png' ? 'image/png' : 'image/jpeg');
    reply.header('Cache-Control', 'no-cache');
    return backupSvc.readBackupStream(company.logo_path);
  });

  app.get('/v1/settings', adminOnly, async (req) => companySvc.listSettings(ctxOf(req).companyId));

  app.put('/v1/settings/:key', adminOnly, async (req) => {
    const { key } = parse(z.object({ key: z.string().min(1).max(80) }), req.params);
    const body = parse(z.object({ value: z.unknown() }), req.body);
    await companySvc.setSetting(ctxOf(req), key, body.value);
    return { ok: true };
  });

  // ══════════ المستخدمون ══════════

  app.get('/v1/users', adminOnly, async (req) => ({
    items: await userSvc.listUsers(ctxOf(req).companyId),
  }));

  app.post('/v1/users', adminOnly, async (req, reply) => {
    const body = parse(
      z.object({
        fullName: z.string().min(2).max(120),
        username: z.string().min(3).max(60).regex(/^[A-Za-z0-9._-]+$/),
        email: z.string().email().max(160).nullish(),
        password: z.string().min(8).max(200),
        role: z.enum(['ADMIN', 'SUPERVISOR', 'VIEWER']),
      }),
      req.body,
    );
    return reply.status(201).send(await userSvc.createUser(ctxOf(req), body));
  });

  app.patch('/v1/users/:id', adminOnly, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    const body = parse(
      z.object({
        fullName: z.string().min(2).max(120).optional(),
        email: z.string().email().max(160).nullish(),
        role: z.enum(['ADMIN', 'SUPERVISOR', 'VIEWER']).optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(8).max(200).optional(),
      }),
      req.body,
    );
    return userSvc.updateUser(ctxOf(req), id, body);
  });

  app.delete('/v1/users/:id', adminOnly, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    await userSvc.deleteUser(ctxOf(req), id);
    return { ok: true };
  });

  // ══════════ السيارات والعمال ══════════

  app.get('/v1/vehicles', admin, async (req) => {
    const { companyId, day } = await companyDay();
    void ctxOf(req);
    return { items: await fleetSvc.listVehicles(companyId, day) };
  });

  app.post('/v1/vehicles', supervisor, async (req, reply) => {
    const body = parse(
      z.object({
        internalNo: z.string().min(1).max(40),
        name: z.string().max(120).nullish(),
        plateNo: z.string().max(40).nullish(),
        vehicleType: z.string().max(60).nullish(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
      }),
      req.body,
    );
    return reply.status(201).send(await fleetSvc.createVehicle(ctxOf(req), body));
  });

  app.patch('/v1/vehicles/:id', supervisor, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    const body = parse(
      z.object({
        internalNo: z.string().min(1).max(40).optional(),
        name: z.string().max(120).nullish(),
        plateNo: z.string().max(40).nullish(),
        vehicleType: z.string().max(60).nullish(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
      }),
      req.body,
    );
    return fleetSvc.updateVehicle(ctxOf(req), id, body);
  });

  app.delete('/v1/vehicles/:id', adminOnly, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    await fleetSvc.deleteVehicle(ctxOf(req), id);
    return { ok: true };
  });

  app.post('/v1/vehicles/:id/assign', supervisor, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    const body = parse(z.object({ workerId: uuid.nullable() }), req.body);
    return fleetSvc.assignDriver(ctxOf(req), id, body.workerId);
  });

  app.get('/v1/workers', admin, async (req) => {
    const { companyId, day } = await companyDay();
    void ctxOf(req);
    return { items: await fleetSvc.listWorkers(companyId, day) };
  });

  app.post('/v1/workers', supervisor, async (req, reply) => {
    const body = parse(
      z.object({
        fullName: z.string().min(2).max(120),
        employeeNo: z.string().min(1).max(40),
        phone: z.string().max(40).nullish(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        defaultVehicleId: uuid.nullish(),
      }),
      req.body,
    );
    return reply.status(201).send(await fleetSvc.createWorker(ctxOf(req), body));
  });

  app.patch('/v1/workers/:id', supervisor, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    const body = parse(
      z.object({
        fullName: z.string().min(2).max(120).optional(),
        employeeNo: z.string().min(1).max(40).optional(),
        phone: z.string().max(40).nullish(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        defaultVehicleId: uuid.nullish(),
      }),
      req.body,
    );
    return fleetSvc.updateWorker(ctxOf(req), id, body);
  });

  app.delete('/v1/workers/:id', adminOnly, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    await fleetSvc.deleteWorker(ctxOf(req), id);
    return { ok: true };
  });

  // ══════════ الحاويات ══════════

  app.get('/v1/bins', admin, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const { companyId, day } = await companyDay();
    return binSvc.listBins(
      companyId,
      {
        q: q.q,
        sector: q.sector,
        area: q.area,
        status: q.status as 'ACTIVE' | 'DISABLED' | undefined,
        servicedOn: q.servicedOn,
        serviced: q.serviced as 'YES' | 'NO' | undefined,
        page: intOr(q.page, 1),
        pageSize: intOr(q.pageSize, 50),
      },
      day,
    );
  });

  app.get('/v1/bins/sectors', admin, async (req) => ({
    items: await binSvc.listSectors(ctxOf(req).companyId),
  }));

  app.get('/v1/bins/map', admin, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const { companyId, day } = await companyDay();
    return { items: await binSvc.mapBins(companyId, q.day ?? day) };
  });

  app.post('/v1/bins', supervisor, async (req, reply) => {
    const body = parse(binInputSchema, req.body);
    return reply.status(201).send(await binSvc.createBin(ctxOf(req), body));
  });

  app.get('/v1/bins/:id', admin, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    const ctx = ctxOf(req);
    const bin = await binSvc.getBin(ctx.companyId, id);
    const recent = await scanSvc.listScans(ctx.companyId, { binId: id, pageSize: 20 });
    return {
      ...binSvc.toBinDto(bin),
      qrToken: await binSvc.binQrToken(ctx.companyId, id).catch(() => null),
      recentScans: recent.items,
    };
  });

  app.patch('/v1/bins/:id', supervisor, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    const body = parse(binInputSchema.partial(), req.body);
    return binSvc.updateBin(ctxOf(req), id, body);
  });

  app.delete('/v1/bins/:id', adminOnly, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    await binSvc.deleteBin(ctxOf(req), id);
    return { ok: true };
  });

  app.post('/v1/bins/import', supervisor, async (req) => {
    const ctx = ctxOf(req);
    const contentType = String(req.headers['content-type'] ?? '');

    if (contentType.includes('multipart/form-data')) {
      const file = await (req as FastifyRequest & { file: () => Promise<any> }).file();
      if (!file) throw new AppError('BAD_REQUEST', 'لم يُرفع أي ملف');
      const buffer = await file.toBuffer();
      const parsed = binSvc.parseBinsCsv(buffer.toString('utf8'));
      return binSvc.importBins(ctx, parsed);
    }

    const body = parse(
      z.object({
        csv: z.string().optional(),
        items: z
          .array(
            z.object({
              publicId: z.string().max(40).optional(),
              name: z.string().max(200).optional(),
              sector: z.string().max(120).optional(),
              area: z.string().max(120).optional(),
              address: z.string().max(400).optional(),
              lat,
              lon,
              gpsRadiusM: z.number().int().min(5).max(5000).optional(),
            }),
          )
          .optional(),
      }),
      req.body,
    );
    const items = body.items ?? (body.csv ? binSvc.parseBinsCsv(body.csv) : null);
    if (!items) throw new AppError('BAD_REQUEST', 'أرسل ملفًا أو حقل csv أو مصفوفة items');
    return binSvc.importBins(ctx, items);
  });

  // ══════════ مركز QR ══════════

  app.get('/v1/qr/summary', admin, async (req) => qrSvc.qrSummary(ctxOf(req).companyId));

  app.post('/v1/qr/stickers', supervisor, async (req, reply) => {
    const body = parse(
      z.object({
        binIds: z.array(uuid).max(5000).optional(),
        sector: z.string().max(120).optional(),
        all: z.boolean().optional(),
        onlyNotPrinted: z.boolean().optional(),
        markPrinted: z.boolean().optional(),
      }),
      req.body ?? {},
    );
    const ctx = ctxOf(req);
    const { pdf, binIds, count } = await qrSvc.generateStickersPdf(ctx, body);
    if (body.markPrinted) await qrSvc.markPrinted(ctx, binIds);
    reply
      .type('application/pdf')
      .header('X-Vero-Sticker-Count', String(count))
      .header('Content-Disposition', `attachment; filename="vero-qr-stickers-${count}.pdf"`);
    return pdf;
  });

  app.post('/v1/qr/mark-printed', supervisor, async (req) => {
    const body = parse(z.object({ binIds: z.array(uuid).min(1).max(5000) }), req.body);
    return { updated: await qrSvc.markPrinted(ctxOf(req), body.binIds) };
  });

  app.get('/v1/qr/bin/:id.png', admin, async (req, reply) => {
    const { id } = parse(z.object({ id: uuid }), (req.params as { id: string }));
    const q = req.query as { size?: string };
    const png = await qrSvc.binQrPng(ctxOf(req).companyId, id, intOr(q.size, 400));
    reply.type('image/png');
    return png;
  });

  app.post('/v1/qr/bin/:id/regenerate', adminOnly, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    return { token: await qrSvc.regenerateToken(ctxOf(req), id) };
  });

  // ══════════ الأجهزة والتفعيل ══════════

  app.get('/v1/devices', admin, async (req) => ({
    items: await deviceSvc.listDevices(ctxOf(req).companyId),
  }));

  app.post('/v1/devices/:id/revoke', adminOnly, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    await deviceSvc.revokeDevice(ctxOf(req), id);
    return { ok: true };
  });

  app.get('/v1/devices/activation-codes', supervisor, async (req) => ({
    items: await deviceSvc.listActivationCodes(ctxOf(req).companyId),
  }));

  app.post('/v1/devices/activation-codes', supervisor, async (req, reply) => {
    const body = parse(
      z.object({
        workerId: uuid,
        vehicleId: uuid,
        ttlHours: z.number().int().min(1).max(720).optional(),
      }),
      req.body,
    );
    return reply.status(201).send(await deviceSvc.createActivationCode(ctxOf(req), body));
  });

  app.get('/v1/devices/activation-codes/:id.pdf', supervisor, async (req, reply) => {
    const { id } = parse(z.object({ id: uuid }), (req.params as { id: string }));
    const ctx = ctxOf(req);
    const list = await deviceSvc.listActivationCodes(ctx.companyId);
    const item = list.find((c) => c.id === id);
    if (!item) throw new AppError('NOT_FOUND', 'كود التفعيل غير موجود');
    const pdf = await qrSvc.activationSheetPdf(ctx.companyId, {
      code: item.code,
      workerName: item.workerName,
      vehicleNo: item.vehicleNo,
      expiresAt: item.expiresAt,
    });
    reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="vero-activation-${item.code}.pdf"`);
    return pdf;
  });

  app.post(
    '/v1/devices/activate',
    { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const body = parse(
        z.object({
          code: z.string().min(6).max(80),
          deviceUid: z.string().min(6).max(200),
          platform: z.string().max(40).optional(),
          model: z.string().max(120).optional(),
          appVersion: z.string().max(40).optional(),
        }),
        req.body,
      );
      const res = await deviceSvc.activateDevice(body, {
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
      });
      return reply.status(201).send(res);
    },
  );

  app.get('/v1/devices/me', device, async (req) => {
    const d = deviceOf(req);
    const { day } = await companyDay();
    const stats = await one<{ done: number; total: number }>(
      `SELECT
        (SELECT count(*)::int FROM scans
          WHERE worker_id = $1 AND service_day = $2 AND counted) AS done,
        (SELECT count(*)::int FROM bins WHERE company_id = $3 AND status = 'ACTIVE') AS total`,
      [d.workerId, day, d.companyId],
    );
    const session = await routeSvc.currentSession(d);
    const company = await companySvc.requireCompany();
    return {
      device: { id: d.id, deviceUid: d.deviceUid },
      worker: { id: d.workerId, fullName: (d as { workerName?: string }).workerName ?? '' },
      vehicle: { id: d.vehicleId, internalNo: (d as { vehicleNo?: string }).vehicleNo ?? '' },
      company: { name: company.name, timezone: company.timezone },
      serviceDay: day,
      doneToday: stats?.done ?? 0,
      remaining: Math.max(0, (stats?.total ?? 0) - (stats?.done ?? 0)),
      totalBins: stats?.total ?? 0,
      session,
    };
  });

  // ══════════ المسح والمزامنة ══════════

  app.post('/v1/scans', device, async (req, reply) => {
    const body = parse(scanInputSchema, req.body);
    const d = deviceOf(req);
    const tz = req.deviceTimezone ?? 'Asia/Riyadh';
    const result = await scanSvc.recordScan(d, tz, body, {
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] ?? ''),
    });
    return reply.status(result.outcome === 'rejected' ? 422 : 201).send(result);
  });

  app.post('/v1/sync/scans', device, async (req) => {
    const body = parse(
      z.object({ items: z.array(scanInputSchema).min(1).max(500) }),
      req.body,
    );
    const d = deviceOf(req);
    const tz = req.deviceTimezone ?? 'Asia/Riyadh';
    const results: Awaited<ReturnType<typeof scanSvc.recordScan>>[] = [];
    for (const item of body.items) {
      results.push(
        await scanSvc.recordScan(d, tz, { ...item, offline: true }, { ip: req.ip }),
      );
    }
    return {
      results,
      summary: {
        accepted: results.filter((r) => r.outcome === 'accepted').length,
        duplicates: results.filter((r) => r.outcome === 'duplicate').length,
        rejected: results.filter((r) => r.outcome === 'rejected').length,
      },
    };
  });

  app.post('/v1/sync/route-points', device, async (req) => {
    const body = parse(
      z.object({ sessionId: uuid, points: z.array(routePointSchema).min(1).max(2000) }),
      req.body,
    );
    return routeSvc.addRoutePoints(deviceOf(req), body.sessionId, body.points);
  });

  app.get('/v1/sync/state', device, async (req) => {
    const d = deviceOf(req);
    const { day } = await companyDay();
    const r = await one<{ scans: number; offline: number }>(
      `SELECT
         (SELECT count(*)::int FROM scans WHERE device_id = $1 AND service_day = $2)              AS scans,
         (SELECT count(*)::int FROM scans WHERE device_id = $1 AND service_day = $2 AND offline)  AS offline`,
      [d.id, day],
    );
    return { serviceDay: day, serverScansToday: r?.scans ?? 0, syncedOffline: r?.offline ?? 0 };
  });

  app.get('/v1/scans', admin, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return scanSvc.listScans(ctxOf(req).companyId, {
      from: q.from,
      to: q.to,
      status: q.status as scanSvc.ScanStatus | undefined,
      reviewStatus: q.reviewStatus as 'NONE' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | undefined,
      binId: q.binId,
      workerId: q.workerId,
      vehicleId: q.vehicleId,
      countedOnly: q.countedOnly === 'true',
      page: intOr(q.page, 1),
      pageSize: intOr(q.pageSize, 50),
    });
  });

  app.get('/v1/scans/chain/verify', adminOnly, async (req) =>
    scanSvc.verifyChain(ctxOf(req).companyId),
  );

  app.get('/v1/scans/:id', admin, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    return scanSvc.getScan(ctxOf(req).companyId, id);
  });

  app.post('/v1/scans/:id/review', supervisor, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    const body = parse(
      z.object({
        reviewStatus: z.enum(['ACCEPTED', 'REJECTED']),
        note: z.string().max(1000).optional(),
      }),
      req.body,
    );
    return scanSvc.reviewScan(ctxOf(req), id, body);
  });

  // ══════════ خطوط السير ══════════

  app.post('/v1/routes/sessions', device, async (req, reply) => {
    const body = parse(
      z.object({ startedAt: z.string().datetime({ offset: true }).optional() }),
      req.body ?? {},
    );
    const tz = req.deviceTimezone ?? 'Asia/Riyadh';
    return reply.status(201).send(await routeSvc.startSession(deviceOf(req), tz, body.startedAt));
  });

  app.post('/v1/routes/sessions/:id/end', device, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    await routeSvc.endSession(deviceOf(req), id);
    return { ok: true };
  });

  app.get('/v1/routes/live', admin, async (req) => {
    const { companyId, day } = await companyDay();
    void ctxOf(req);
    return { items: await routeSvc.liveVehicles(companyId, day) };
  });

  app.get('/v1/routes/sessions', admin, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return { items: await routeSvc.listSessions(ctxOf(req).companyId, q) };
  });

  app.get('/v1/routes/sessions/:id', admin, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    return routeSvc.getSessionTrack(ctxOf(req).companyId, id);
  });

  // ══════════ اللوحة و«تحتاج انتباه» ══════════

  app.get('/v1/dashboard', admin, async (req) => {
    const q = req.query as { day?: string };
    const { companyId, day } = await companyDay();
    void ctxOf(req);
    return dashSvc.dashboard(companyId, q.day ?? day);
  });

  app.get('/v1/attention', admin, async (req) => {
    const q = req.query as { day?: string; perKind?: string };
    const { companyId, day } = await companyDay();
    void ctxOf(req);
    return dashSvc.attention(companyId, q.day ?? day, intOr(q.perKind, 50));
  });

  // ══════════ عقود SLA والتقارير ══════════

  app.get('/v1/sla-contracts', admin, async (req) => ({
    items: await reportSvc.listSlaContracts(ctxOf(req).companyId),
  }));

  app.post('/v1/sla-contracts', supervisor, async (req, reply) => {
    const body = parse(
      z.object({
        name: z.string().min(2).max(160),
        clientName: z.string().max(160).nullish(),
        requiredVisitsPerDay: z.number().int().min(1).max(24),
        scopeSector: z.string().max(120).nullish(),
        expectedPoints: z.number().int().min(0).max(1_000_000).nullish(),
        activeFrom: isoDay,
        activeTo: isoDay.nullish(),
      }),
      req.body,
    );
    return reply.status(201).send(await reportSvc.createSlaContract(ctxOf(req), body));
  });

  app.get('/v1/reports', admin, async (req) => ({
    items: (await reportSvc.listReports(ctxOf(req).companyId)).map((r) => ({
      id: r.id,
      reportNo: r.reportNo,
      kind: r.kind,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
      createdByName: r.createdByName,
      complianceRate: r.payload.sla.complianceRate,
    })),
  }));

  app.post('/v1/reports', supervisor, async (req, reply) => {
    const body = parse(
      z.object({
        kind: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
        from: isoDay,
        to: isoDay,
        slaContractId: uuid.nullish(),
      }),
      req.body,
    );
    return reply.status(201).send(await reportSvc.createReport(ctxOf(req), body));
  });

  app.get('/v1/reports/preview', admin, async (req) => {
    const q = parse(
      z.object({
        kind: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
        from: isoDay,
        to: isoDay,
        slaContractId: uuid.optional(),
      }),
      req.query,
    );
    return reportSvc.computeReport(ctxOf(req).companyId, {
      kind: q.kind ?? 'CUSTOM',
      from: q.from,
      to: q.to,
      slaContractId: q.slaContractId ?? null,
    });
  });

  app.get('/v1/reports/:id', admin, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    return reportSvc.getReport(ctxOf(req).companyId, id);
  });

  app.get('/v1/reports/:id.pdf', admin, async (req, reply) => {
    const { id } = parse(z.object({ id: uuid }), req.params as { id: string });
    const ctx = ctxOf(req);
    const report = await reportSvc.getReport(ctx.companyId, id);
    const company = await companySvc.requireCompany();
    const pdf = await reportRender.renderReportPdf(report, company);
    reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${report.reportNo}.pdf"`);
    return pdf;
  });

  app.get('/v1/reports/:id.xlsx', admin, async (req, reply) => {
    const { id } = parse(z.object({ id: uuid }), req.params as { id: string });
    const report = await reportSvc.getReport(ctxOf(req).companyId, id);
    const xlsx = await reportRender.renderReportXlsx(report);
    reply
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${report.reportNo}.xlsx"`);
    return xlsx;
  });

  // تحقق عام من التقرير — بدون مصادقة وبدون بيانات تشغيلية
  app.get('/v1/verify/:token', async (req, reply) => {
    const { token } = parse(
      z.object({ token: z.string().min(8).max(120) }),
      req.params,
    );
    const v = await reportSvc.verifyReport(token);
    const accept = String(req.headers.accept ?? '');
    if (accept.includes('application/json')) return v;
    reply.type('text/html; charset=utf-8');
    return reportRender.renderVerifyHtml(v);
  });

  // ══════════ سجل العمليات ══════════

  app.get('/v1/audit', adminOnly, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return auditSvc.listAudit(ctxOf(req).companyId, {
      action: q.action,
      entity: q.entity,
      entityId: q.entityId,
      actorUserId: q.actorUserId,
      from: q.from,
      to: q.to,
      page: intOr(q.page, 1),
      pageSize: intOr(q.pageSize, 50),
    });
  });

  app.get('/v1/audit/actions', adminOnly, async (req) => ({
    items: await auditSvc.auditActions(ctxOf(req).companyId),
  }));

  // ══════════ النسخ الاحتياطي ══════════

  app.get('/v1/backups', adminOnly, async (req) => ({
    items: await backupSvc.listBackups(ctxOf(req).companyId),
  }));

  app.post('/v1/backups', adminOnly, async (req, reply) =>
    reply.status(201).send(await backupSvc.createBackup(ctxOf(req))),
  );

  app.get('/v1/backups/:id/download', adminOnly, async (req, reply) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    const path = await backupSvc.backupFilePath(ctxOf(req).companyId, id);
    reply
      .type('application/gzip')
      .header('Content-Disposition', `attachment; filename="${path.split('/').pop()}"`);
    return backupSvc.readBackupStream(path);
  });

  app.delete('/v1/backups/:id', adminOnly, async (req) => {
    const { id } = parse(z.object({ id: uuid }), req.params);
    await backupSvc.deleteBackup(ctxOf(req), id);
    return { ok: true };
  });

  app.post('/v1/backups/restore', adminOnly, async (req) => {
    const ctx = ctxOf(req);
    const contentType = String(req.headers['content-type'] ?? '');
    if (!contentType.includes('multipart/form-data')) {
      throw new AppError('BAD_REQUEST', 'أرسل ملف النسخة الاحتياطية عبر multipart/form-data');
    }
    const file = await (req as FastifyRequest & { file: () => Promise<any> }).file();
    if (!file) throw new AppError('BAD_REQUEST', 'لم يُرفع أي ملف');
    const buffer = await file.toBuffer();
    return backupSvc.restoreBackup(ctx, buffer);
  });
}

export type { FastifyReply };

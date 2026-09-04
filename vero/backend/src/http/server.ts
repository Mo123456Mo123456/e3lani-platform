import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { AppError } from '../core/errors.js';
import { registerRoutes } from './routes.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.isTest
      ? false
      : {
          level: env.isProduction ? 'info' : 'debug',
          // لا نسجّل الأسرار أبدًا
          redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password'],
        },
    trustProxy: true,
    bodyLimit: 20 * 1024 * 1024,
  });

  const allowed = new Set([env.adminOrigin, ...env.corsOrigins].filter(Boolean));
  await app.register(cors, {
    origin(origin, cb) {
      // طلبات بلا Origin (تطبيق الجوال، curl، اختبارات) مسموحة — الحماية عبر الرموز لا عبر CORS
      if (!origin) return cb(null, true);
      if (allowed.size === 0 || allowed.has(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition', 'X-Vero-Sticker-Count'],
  });

  await app.register(rateLimit, {
    global: true,
    max: env.rateLimitMax,
    timeWindow: env.rateLimitWindowMs,
    // مسارات الجهاز تُحدَّد بالرمز لا بالـIP (عدة عمال خلف نفس شبكة الشركة)
    keyGenerator: (req) => {
      const auth = req.headers.authorization;
      if (typeof auth === 'string' && auth.startsWith('Device ')) return auth.slice(0, 48);
      return req.ip;
    },
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'عدد الطلبات تجاوز الحد المسموح. حاول بعد قليل.',
        details: {},
      },
    }),
  });

  await app.register(multipart, {
    limits: { fileSize: 64 * 1024 * 1024, files: 1 },
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'VERO API',
        description:
          'VERO — كل زيارة لها إثبات. واجهة برمجية لنظام إثبات تنفيذ خدمات النظافة عبر QR وGPS.',
        version: env.version,
      },
      servers: [{ url: env.publicBaseUrl }],
      components: {
        securitySchemes: {
          userToken: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          deviceToken: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'القيمة: Device <deviceToken>',
          },
        },
      },
      tags: [
        { name: 'setup', description: 'الإعداد الأول' },
        { name: 'auth', description: 'المصادقة' },
        { name: 'bins', description: 'الحاويات ونقاط الخدمة' },
        { name: 'qr', description: 'مركز QR' },
        { name: 'devices', description: 'أجهزة العمال' },
        { name: 'scans', description: 'الزيارات والإثبات' },
        { name: 'routes', description: 'خطوط السير' },
        { name: 'reports', description: 'التقارير وSLA' },
        { name: 'admin', description: 'الإدارة والنسخ الاحتياطي' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  // معالج أخطاء موحّد: لا يسرّب تفاصيل داخلية في الإنتاج
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send(err.toJSON());
    }
    const anyErr = err as { statusCode?: number; code?: string; validation?: unknown };

    if (anyErr.code === '23505') {
      return reply.status(409).send({
        error: { code: 'CONFLICT', message: 'القيمة مستخدمة مسبقًا', details: {} },
      });
    }
    if (anyErr.code === '23503') {
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'لا يمكن إتمام العملية لوجود سجلات مرتبطة',
          details: {},
        },
      });
    }
    if (anyErr.code === 'ECONNREFUSED' || anyErr.code === '57P01' || anyErr.code === '08006') {
      return reply.status(503).send({
        error: { code: 'DB_UNAVAILABLE', message: 'قاعدة البيانات غير متاحة', details: {} },
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    if (typeof anyErr.statusCode === 'number' && anyErr.statusCode < 500) {
      return reply.status(anyErr.statusCode).send({
        error: { code: 'BAD_REQUEST', message, details: {} },
      });
    }

    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL',
        message: 'خطأ داخلي في الخادم',
        details: env.isProduction ? {} : { reason: message },
      },
    });
  });

  app.setNotFoundHandler((req, reply) =>
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `المسار غير موجود: ${req.method} ${req.url}`,
        details: {},
      },
    }),
  );

  await registerRoutes(app);
  return app;
}

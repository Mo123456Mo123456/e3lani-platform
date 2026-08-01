/**
 * اختبارات تكامل تتطلب تشغيل PostgreSQL و Redis:
 *   pnpm infra:up && pnpm db:deploy && pnpm db:seed
 *   pnpm --filter @e3lani/api test:e2e
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/common/services/redis.service';

/** يمسح عدّادات الحد من المعدل حتى لا تتسرّب حالة بين التشغيلات. */
async function resetRateLimits(app: INestApplication): Promise<void> {
  const redis = app.get(RedisService);
  const keys = await redis.client.keys('rl:*');
  if (keys.length) await redis.client.del(...keys);
}

for (const candidate of ['../../../.env', '../../.env', '.env']) {
  const path = resolve(__dirname, candidate);
  if (existsSync(path)) {
    loadEnv({ path });
    break;
  }
}

describe('واجهات إعلاني العامة', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api');
    await app.init();
    await resetRateLimits(app);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const prefix = `/${process.env.API_PREFIX ?? 'api'}`;

  it('الفحص الصحي يعمل', async () => {
    const response = await request(app.getHttpServer()).get(`${prefix}/health`).expect(200);
    expect(response.body.services.database).toBe('up');
    expect(response.body.services.cache).toBe('up');
  });

  it('يعيد شجرة الأقسام مع الأقسام الفرعية', async () => {
    const response = await request(app.getHttpServer()).get(`${prefix}/categories`).expect(200);
    expect(response.body.length).toBeGreaterThanOrEqual(21);
    expect(response.body[0].children.length).toBeGreaterThan(0);
  });

  it('يعيد الأسعار من قاعدة البيانات لا من الكود', async () => {
    const response = await request(app.getHttpServer()).get(`${prefix}/pricing`).expect(200);
    const standard = response.body.items.find((item: any) => item.key === 'AD_STANDARD');
    expect(standard.amountSar).toBe(59);
    expect(standard.durationDays).toBe(30);
    expect(response.body.publishingMode).toBe('FREE');
  });

  it('الشريط العلوي يعيد شعارات بلا أي روابط قابلة للنقر', async () => {
    const response = await request(app.getHttpServer()).get(`${prefix}/ticker`).expect(200);
    for (const logo of response.body.logos) {
      expect(Object.keys(logo).sort()).toEqual(['businessName', 'id', 'logoUrl', 'sortWeight']);
    }
  });

  it('الموجز يعيد إعلانات فقط ولا يتضمن منشورات مجانية', async () => {
    const response = await request(app.getHttpServer())
      .get(`${prefix}/feed?tab=latest&limit=5`)
      .expect(200);
    for (const item of response.body.items) {
      expect(item.status).toBe('ACTIVE');
      expect(item).toHaveProperty('contactMethod');
      expect(item).not.toHaveProperty('caption');
    }
  });

  it('يمنع الوصول للمسارات المحمية بدون رمز', async () => {
    await request(app.getHttpServer()).get(`${prefix}/ads/mine`).expect(401);
    await request(app.getHttpServer()).get(`${prefix}/saved/ads`).expect(401);
  });

  it('يمنع دخول لوحة الإدارة بدون رمز إدارة', async () => {
    await request(app.getHttpServer()).get(`${prefix}/admin/users`).expect(401);
  });

  it('يرفض بيانات دخول إدارة خاطئة', async () => {
    await request(app.getHttpServer())
      .post(`${prefix}/auth/admin/login`)
      .send({ email: 'nobody@e3lani.sa', password: 'WrongPassword123' })
      .expect(401);
  });

  it('يرفض رقم جوال غير سعودي عند طلب الرمز', async () => {
    const response = await request(app.getHttpServer())
      .post(`${prefix}/auth/otp/request`)
      .send({ phone: '0412345678' })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('لا يعيد رمز التحقق في الاستجابة إطلاقًا', async () => {
    const response = await request(app.getHttpServer())
      .post(`${prefix}/auth/otp/request`)
      .send({ phone: '0555000111' });
    expect(JSON.stringify(response.body)).not.toMatch(/"code"\s*:\s*"\d{4,6}"/);
    expect(response.body).not.toHaveProperty('debugCode');
  });
});

describe('الميزات المضافة: الأسعار المؤرَّخة والخصوصية والفوترة', () => {
  let app: INestApplication;
  let adminToken: string;
  const prefix = `/${process.env.API_PREFIX ?? 'api'}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api');
    await app.init();
    await resetRateLimits(app);

    const login = await request(app.getHttpServer())
      .post(`${prefix}/auth/admin/login`)
      .send({
        email: process.env.SEED_SUPER_ADMIN_EMAIL,
        password: process.env.SEED_SUPER_ADMIN_PASSWORD,
      });
    adminToken = login.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  it('يعرض السعر النافذ مع خطه الزمني الكامل', async () => {
    const response = await request(app.getHttpServer())
      .get(`${prefix}/admin/pricing`)
      .set(auth())
      .expect(200);

    const standard = response.body.find((row: any) => row.key === 'AD_STANDARD');
    expect(standard.current).toBeTruthy();
    expect(standard.history.length).toBeGreaterThanOrEqual(1);
    // لا يوجد أكثر من إصدار نافذ في اللحظة نفسها
    expect(standard.history.filter((v: any) => v.status === 'ACTIVE')).toHaveLength(1);
  });

  it('يرفض إدراج سعر بأثر رجعي', async () => {
    const response = await request(app.getHttpServer())
      .post(`${prefix}/admin/pricing/versions`)
      .set(auth())
      .send({ key: 'AD_STANDARD', amountHalalas: 100, effectiveFrom: '2020-01-01T00:00:00Z' })
      .expect(400);
    expect(response.body.code).toBe('PRICING_PAST_DATE');
  });

  it('يجدول تغيير سعر مستقبلي دون المساس بالسعر النافذ', async () => {
    const before = await request(app.getHttpServer()).get(`${prefix}/pricing`).expect(200);
    const currentPrice = before.body.items.find((item: any) => item.key === 'HIGHLIGHT_3').amountSar;

    const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const created = await request(app.getHttpServer())
      .post(`${prefix}/admin/pricing/versions`)
      .set(auth())
      .send({ key: 'HIGHLIGHT_3', amountHalalas: 4242, effectiveFrom: future, note: 'اختبار' })
      .expect(201);

    expect(created.body.status).toBe('SCHEDULED');

    const after = await request(app.getHttpServer()).get(`${prefix}/pricing`).expect(200);
    expect(after.body.items.find((item: any) => item.key === 'HIGHLIGHT_3').amountSar).toBe(
      currentPrice,
    );

    // تنظيف: إلغاء الإصدار المجدول
    await request(app.getHttpServer())
      .delete(`${prefix}/admin/pricing/versions/${created.body.id}`)
      .set(auth())
      .expect(200);
  });

  it('يمنع غير المصرّح لهم من تعديل الأسعار أو الاطلاع على طلبات البيانات', async () => {
    await request(app.getHttpServer())
      .post(`${prefix}/admin/pricing/versions`)
      .send({ key: 'AD_STANDARD', amountHalalas: 1 })
      .expect(401);
    await request(app.getHttpServer()).get(`${prefix}/admin/data-requests`).expect(401);
  });

  it('يحمي مسارات الخصوصية بتسجيل الدخول', async () => {
    await request(app.getHttpServer()).get(`${prefix}/me/privacy/consents`).expect(401);
    await request(app.getHttpServer()).post(`${prefix}/me/privacy/data-requests`).expect(401);
  });

  it('يرفض إصدار فاتورة لعملية غير موجودة', async () => {
    await request(app.getHttpServer())
      .get(`${prefix}/admin/payments/nonexistent-payment-id`)
      .set(auth())
      .expect(404);
  });
});

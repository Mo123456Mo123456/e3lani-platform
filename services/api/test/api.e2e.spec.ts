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

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool } from '../src/db/pool.js';
import { ADMIN, authHeader, closeApp, freshWorld, type TestWorld } from './helpers.js';

let w: TestWorld;
let supervisorToken: string;
let viewerToken: string;

async function makeUser(role: 'SUPERVISOR' | 'VIEWER', username: string): Promise<string> {
  const created = await w.app.inject({
    method: 'POST',
    url: '/v1/users',
    headers: authHeader(w.accessToken),
    payload: {
      fullName: `مستخدم ${role}`,
      username,
      password: 'Test#123456',
      role,
    },
  });
  if (created.statusCode !== 201) throw new Error(`فشل إنشاء المستخدم: ${created.body}`);

  const login = await w.app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { username, password: 'Test#123456' },
  });
  return login.json().accessToken as string;
}

beforeAll(async () => {
  w = await freshWorld();
  supervisorToken = await makeUser('SUPERVISOR', 'supervisor1');
  viewerToken = await makeUser('VIEWER', 'viewer1');
});

afterAll(async () => {
  await closeApp();
  await closePool();
});

const newBin = { lat: 24.7, lon: 46.6, name: 'حاوية', sector: 'ق1' };

describe('التحقق من الصلاحيات على الخادم', () => {
  it('المراقب يقرأ اللوحة والخريطة والتقارير', async () => {
    for (const url of ['/v1/dashboard', '/v1/bins', '/v1/bins/map', '/v1/reports', '/v1/attention']) {
      const res = await w.app.inject({ method: 'GET', url, headers: authHeader(viewerToken) });
      expect(res.statusCode, `${url} يجب أن يكون متاحًا للمراقب`).toBe(200);
    }
  });

  it('المراقب لا يستطيع إنشاء أو تعديل أي شيء', async () => {
    const create = await w.app.inject({
      method: 'POST',
      url: '/v1/bins',
      headers: authHeader(viewerToken),
      payload: newBin,
    });
    expect(create.statusCode).toBe(403);
    expect(create.json().error.code).toBe('FORBIDDEN');

    const vehicle = await w.app.inject({
      method: 'POST',
      url: '/v1/vehicles',
      headers: authHeader(viewerToken),
      payload: { internalNo: 'X1' },
    });
    expect(vehicle.statusCode).toBe(403);
  });

  it('المشرف يدير التشغيل لكنه لا يدير المستخدمين ولا النسخ الاحتياطي', async () => {
    const bin = await w.app.inject({
      method: 'POST',
      url: '/v1/bins',
      headers: authHeader(supervisorToken),
      payload: newBin,
    });
    expect(bin.statusCode).toBe(201);

    const users = await w.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: authHeader(supervisorToken),
    });
    expect(users.statusCode).toBe(403);

    const backups = await w.app.inject({
      method: 'POST',
      url: '/v1/backups',
      headers: authHeader(supervisorToken),
    });
    expect(backups.statusCode).toBe(403);

    const del = await w.app.inject({
      method: 'DELETE',
      url: `/v1/bins/${bin.json().id}`,
      headers: authHeader(supervisorToken),
    });
    expect(del.statusCode, 'الحذف للمدير فقط').toBe(403);
  });

  it('المدير يملك كل الصلاحيات', async () => {
    const bin = await w.app.inject({
      method: 'POST',
      url: '/v1/bins',
      headers: authHeader(w.accessToken),
      payload: { ...newBin, publicId: 'VR-ADMIN-1' },
    });
    expect(bin.statusCode).toBe(201);
    const del = await w.app.inject({
      method: 'DELETE',
      url: `/v1/bins/${bin.json().id}`,
      headers: authHeader(w.accessToken),
    });
    expect(del.statusCode).toBe(200);
  });

  it('يرفض الطلبات بلا رمز', async () => {
    const res = await w.app.inject({ method: 'GET', url: '/v1/bins' });
    expect(res.statusCode).toBe(401);
  });

  it('تغيير الدور يسري فورًا على الرمز الحالي', async () => {
    const list = await w.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: authHeader(w.accessToken),
    });
    const viewer = (list.json().items as { id: string; username: string }[]).find(
      (u) => u.username === 'viewer1',
    )!;

    // قبل الترقية: ممنوع
    expect(
      (
        await w.app.inject({
          method: 'POST',
          url: '/v1/bins',
          headers: authHeader(viewerToken),
          payload: { ...newBin, publicId: 'VR-ROLE-1' },
        })
      ).statusCode,
    ).toBe(403);

    await w.app.inject({
      method: 'PATCH',
      url: `/v1/users/${viewer.id}`,
      headers: authHeader(w.accessToken),
      payload: { role: 'SUPERVISOR' },
    });

    // بعد الترقية: مسموح بنفس الرمز القديم، لأن الدور يُقرأ من قاعدة البيانات
    expect(
      (
        await w.app.inject({
          method: 'POST',
          url: '/v1/bins',
          headers: authHeader(viewerToken),
          payload: { ...newBin, publicId: 'VR-ROLE-2' },
        })
      ).statusCode,
    ).toBe(201);
  });

  it('تعطيل الحساب يمنع الوصول فورًا', async () => {
    const list = await w.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: authHeader(w.accessToken),
    });
    const sup = (list.json().items as { id: string; username: string }[]).find(
      (u) => u.username === 'supervisor1',
    )!;

    await w.app.inject({
      method: 'PATCH',
      url: `/v1/users/${sup.id}`,
      headers: authHeader(w.accessToken),
      payload: { isActive: false },
    });

    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/bins',
      headers: authHeader(supervisorToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('حماية حساب المدير', () => {
  it('يمنع تعطيل آخر مدير نشط', async () => {
    const res = await w.app.inject({
      method: 'PATCH',
      url: `/v1/users/${w.adminId}`,
      headers: authHeader(w.accessToken),
      payload: { isActive: false },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toContain('آخر مدير');
  });

  it('يمنع حذف الحساب الحالي', async () => {
    const res = await w.app.inject({
      method: 'DELETE',
      url: `/v1/users/${w.adminId}`,
      headers: authHeader(w.accessToken),
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('المصادقة والجلسات', () => {
  it('يرفض كلمة مرور خاطئة برسالة عامة', async () => {
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { username: ADMIN.username, password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
    // نفس الرسالة لمستخدم غير موجود — لا تسريب لوجود الحساب
    const unknown = await w.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { username: 'nobody-here', password: 'wrong-password' },
    });
    expect(unknown.json().error.message).toBe(res.json().error.message);
  });

  it('يجدّد الجلسة ويُبطل رمز التجديد المستخدم', async () => {
    const login = await w.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: ADMIN,
    });
    const refreshToken = login.json().refreshToken as string;

    const first = await w.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().accessToken).toBeTruthy();

    // الرمز القديم لم يعد صالحًا (تدوير الرموز)
    const reuse = await w.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
  });

  it('تغيير كلمة المرور يُبطل الجلسات القائمة', async () => {
    const username = 'rotate-user';
    const token = await makeUser('VIEWER', username);
    const login = await w.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { username, password: 'Test#123456' },
    });
    const refreshToken = login.json().refreshToken as string;

    const list = await w.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: authHeader(w.accessToken),
    });
    const user = (list.json().items as { id: string; username: string }[]).find(
      (u) => u.username === username,
    )!;

    await w.app.inject({
      method: 'PATCH',
      url: `/v1/users/${user.id}`,
      headers: authHeader(w.accessToken),
      payload: { password: 'NewPass#98765' },
    });

    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(401);
    void token;
  });
});

describe('معالج الإعداد', () => {
  it('لا يعمل مرتين', async () => {
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/setup',
      payload: {
        company: { name: 'شركة أخرى', defaultGpsRadiusM: 30 },
        admin: {
          fullName: 'مدير آخر',
          username: 'admin2',
          password: 'Another#12345',
        },
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('SETUP_ALREADY_COMPLETED');
  });

  it('حالة الإعداد متاحة بلا مصادقة', async () => {
    const res = await w.app.inject({ method: 'GET', url: '/v1/setup/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json().setupCompleted).toBe(true);
  });
});

describe('سجل العمليات', () => {
  it('يسجّل الإنشاء والتعديل مع القيم قبل وبعد', async () => {
    const bin = await w.app.inject({
      method: 'POST',
      url: '/v1/bins',
      headers: authHeader(w.accessToken),
      payload: { ...newBin, publicId: 'VR-AUDIT-1', name: 'الاسم الأول' },
    });
    const binId = bin.json().id as string;

    await w.app.inject({
      method: 'PATCH',
      url: `/v1/bins/${binId}`,
      headers: authHeader(w.accessToken),
      payload: { name: 'الاسم الثاني' },
    });

    const audit = await w.app.inject({
      method: 'GET',
      url: `/v1/audit?entity=bin&entityId=${binId}`,
      headers: authHeader(w.accessToken),
    });
    expect(audit.statusCode).toBe(200);
    const items = audit.json().items as {
      action: string;
      before: { name?: string } | null;
      after: { name?: string } | null;
      actorName: string | null;
    }[];

    const update = items.find((i) => i.action === 'bin.update');
    expect(update).toBeDefined();
    expect(update!.before!.name).toBe('الاسم الأول');
    expect(update!.after!.name).toBe('الاسم الثاني');
    expect(update!.actorName).toBe('مدير النظام');
    expect(items.some((i) => i.action === 'bin.create')).toBe(true);
  });

  it('سجل العمليات للمدير فقط', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/audit',
      headers: authHeader(viewerToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('لا يخزّن كلمات المرور في السجل', async () => {
    await w.app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: authHeader(w.accessToken),
      payload: {
        fullName: 'مستخدم سري',
        username: 'secret-user',
        password: 'SuperSecret#123',
        role: 'VIEWER',
      },
    });
    const audit = await w.app.inject({
      method: 'GET',
      url: '/v1/audit?entity=user',
      headers: authHeader(w.accessToken),
    });
    expect(JSON.stringify(audit.json())).not.toContain('SuperSecret');
  });
});

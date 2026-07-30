import path from 'node:path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import { resetDbForTests } from '../db/client.js';
import { seed } from '../db/seed.js';
import { runLocalTick } from '../services/local-sim.js';
import type { FastifyInstance } from 'fastify';

const TEST_DB = path.resolve('/tmp/planet-api-test.db');

describe('API auth + RBAC + contribution inject', () => {
  let app: FastifyInstance;
  let planetId: string;
  let explorerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.SQLITE_PATH = TEST_DB;
    resetDbForTests(TEST_DB);
    const seeded = await seed(TEST_DB);
    planetId = seeded.planetId;
    app = await buildApp({ jwtSecret: 'test-secret', logger: false });
    await app.ready();

    const loginExplorer = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'explorer@planet.local', password: 'Explorer@123' },
    });
    expect(loginExplorer.statusCode).toBe(200);
    explorerToken = loginExplorer.json().accessToken;

    const loginAdmin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@planet.local', password: 'Admin@Planet2026!' },
    });
    expect(loginAdmin.statusCode).toBe(200);
    adminToken = loginAdmin.json().accessToken;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('registers and logs in a new user', async () => {
    const email = `user_${Date.now()}@test.local`;
    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'Password123!', displayName: 'Tester' },
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().accessToken).toBeTruthy();
    expect(reg.json().refreshToken).toBeTruthy();

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${reg.json().accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(email);
  });

  it('rotates refresh tokens', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'explorer@planet.local', password: 'Explorer@123' },
    });
    const refresh = login.json().refreshToken;
    const rotated = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: refresh },
    });
    expect(rotated.statusCode).toBe(200);
    expect(rotated.json().refreshToken).not.toBe(refresh);

    const reuse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: refresh },
    });
    expect(reuse.statusCode).toBe(401);
  });

  it('enforces RBAC on admin routes', async () => {
    const denied = await app.inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { authorization: `Bearer ${explorerToken}` },
    });
    expect(denied.statusCode).toBe(403);

    const ok = await app.inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().planets).toBeGreaterThanOrEqual(1);
  });

  it('injects contributions deterministically', async () => {
    const a = runLocalTick({
      planetId: 'p',
      seed: 'genesis-alpha-2026',
      tick: 51,
      contribution: { type: 'species', title: 'ثعلب القمر', payload: { color: 'silver' } },
    });
    const b = runLocalTick({
      planetId: 'p',
      seed: 'genesis-alpha-2026',
      tick: 51,
      contribution: { type: 'species', title: 'ثعلب القمر', payload: { color: 'silver' } },
    });
    expect(a).toEqual(b);
    expect(a.events.length).toBeGreaterThan(0);

    const preview = await app.inject({
      method: 'POST',
      url: '/contributions',
      headers: { authorization: `Bearer ${explorerToken}` },
      payload: {
        planetId,
        type: 'species',
        title: 'ثعلب القمر',
        description: 'نوع ليلي يعتمد على نباتات الساحل',
        payload: { color: 'silver' },
        inject: false,
      },
    });
    expect(preview.statusCode).toBe(201);
    expect(preview.json().status).toBe('preview');
    expect(['local-sim', 'simulation-models']).toContain(preview.json().preview.source);

    const injected = await app.inject({
      method: 'POST',
      url: `/contributions/${preview.json().id}/inject`,
      headers: { authorization: `Bearer ${explorerToken}` },
    });
    expect(injected.statusCode).toBe(200);
    expect(injected.json().status).toBe('injected');
    expect(injected.json().events.length).toBeGreaterThan(0);

    const again = await app.inject({
      method: 'POST',
      url: `/contributions/${preview.json().id}/inject`,
      headers: { authorization: `Bearer ${explorerToken}` },
      payload: {},
    });
    expect(again.json().already).toBe(true);
  });

  it('lists seeded planet data', async () => {
    const res = await app.inject({ method: 'GET', url: `/planets/${planetId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().stats.civilizations).toBe(12);
    expect(res.json().stats.cities).toBeGreaterThanOrEqual(40);
    expect(res.json().stats.species).toBeGreaterThanOrEqual(300);
    expect(res.json().stats.plants).toBeGreaterThanOrEqual(800);
    expect(res.json().stats.resources).toBeGreaterThanOrEqual(120);
  });
});

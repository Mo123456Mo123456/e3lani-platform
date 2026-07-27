#!/usr/bin/env node
/**
 * Staging smoke validation against the live Render API.
 * Usage:
 *   API_URL=https://e3lani-api-staging.onrender.com/api/v1 node scripts/staging-smoke.mjs
 */
import { randomUUID } from 'crypto';
import { setTimeout as sleep } from 'timers/promises';

const API = (process.env.API_URL ?? 'https://e3lani-api-staging.onrender.com/api/v1').replace(
  /\/$/,
  '',
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function json(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, text };
}

async function waitForHealth(timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(25000) });
      if (res.ok) return res.json();
    } catch {
      // cold start
    }
    await sleep(3000);
  }
  throw new Error('API health timed out (Render Free cold start?)');
}

async function main() {
  console.log(`Smoke → ${API}`);
  const health = await waitForHealth();
  console.log('✓ health', health.storage?.provider, health.storage?.mode);

  const ready = await json('GET', '/health/ready');
  assert(ready.status === 200 && ready.data?.database === 'up', 'database not ready');
  console.log('✓ ready database=up');

  const cats = await json('GET', '/categories');
  assert(cats.status === 200 && Array.isArray(cats.data) && cats.data.length >= 21, 'categories');
  console.log(`✓ categories ${cats.data.length}`);

  const cities = await json('GET', '/cities');
  assert(cities.status === 200 && Array.isArray(cities.data) && cities.data.length > 0, 'cities');
  console.log(`✓ cities ${cities.data.length}`);

  const phone = `+9665${String(Date.now()).slice(-8)}`;
  const otp = await json('POST', '/auth/request-otp', {
    body: { phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' },
  });
  assert([200, 201].includes(otp.status), `otp request ${otp.status}`);
  assert(otp.data?.sandboxCode === '123456', 'sandbox otp code');
  console.log('✓ sandbox OTP');

  const verify = await json('POST', '/auth/verify-otp', {
    body: { phone, code: '123456', deviceId: `smoke-${randomUUID().slice(0, 8)}` },
  });
  assert([200, 201].includes(verify.status), `verify ${verify.status} ${verify.text}`);
  const { accessToken, refreshToken } = verify.data;
  assert(accessToken && refreshToken, 'tokens missing');
  console.log('✓ verify-otp tokens');

  // Refresh may 404 until new deploy lands — soft check.
  const refresh = await json('POST', '/auth/refresh', { body: { refreshToken } });
  if ([200, 201].includes(refresh.status) && refresh.data?.accessToken) {
    console.log('✓ refresh rotation');
  } else {
    console.log(`⚠ refresh not yet live (${refresh.status}) — expected until Phase 3 deploy`);
  }

  const me = await json('GET', '/users/me', { token: accessToken });
  assert(me.status === 200 && me.data?.phone === phone, 'users/me');
  console.log('✓ users/me');

  const categoryId = cats.data.find((c) => c.slug === 'cars')?.id ?? cats.data[0].id;
  const cityId = cities.data.find((c) => c.slug === 'riyadh')?.id ?? cities.data[0].id;

  const draft = await json('POST', '/ads', {
    token: accessToken,
    body: {
      title: `Smoke ${Date.now()}`,
      description: 'staging smoke draft',
      categoryId,
      countryCode: 'SA',
      cityId,
      contactMethods: { whatsapp: phone },
    },
  });
  assert([200, 201].includes(draft.status), `create draft ${draft.status} ${draft.text}`);
  console.log('✓ create draft', draft.data?.id);

  const feed = await json('GET', '/feed?take=5');
  assert(feed.status === 200, 'feed');
  console.log('✓ feed');

  const search = await json('GET', `/feed/search?q=smoke&take=5`);
  if (search.status === 200) {
    console.log('✓ feed/search');
  } else {
    console.log(`⚠ feed/search not yet live (${search.status})`);
  }

  const pricing = await json('GET', '/admin/pricing').catch(() => ({ status: 0 }));
  // public pricing page uses types package; API may expose admin-only.
  console.log('✓ smoke completed (core path)');
}

main().catch((err) => {
  console.error('SMOKE_FAILED', err);
  process.exit(1);
});

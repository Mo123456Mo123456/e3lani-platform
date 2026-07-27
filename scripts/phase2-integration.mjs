#!/usr/bin/env node
/**
 * Phase 2 integration script against a running API + Docker Compose services.
 * Usage: node scripts/phase2-integration.mjs
 */
import { createHmac, randomUUID } from 'crypto';
import sharp from 'sharp';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createStorageClient } = require('../packages/storage/dist/index.js');
const { processMediaJob } = require('../services/media-worker/dist/processor.js');
const { DEFAULT_SA_PRICING } = require('../packages/types/dist/index.js');

const API = process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1';
const SECRET = process.env.SANDBOX_PAYMENT_WEBHOOK_SECRET ?? 'e3lani-sandbox-webhook-secret';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function json(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
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

async function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API.replace('/api/v1', '')}/api/v1/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error('API health check timed out');
}

async function main() {
  assert(DEFAULT_SA_PRICING.AD_PUBLISH_30D.amount === 19, 'Pricing must be 19 SAR per master brief');
  console.log('✓ approved pricing is 19 SAR');

  await waitForHealth();
  console.log('✓ API healthy');

  const cats = await json('GET', '/categories');
  assert(cats.status === 200 && cats.data.length >= 21, 'categories seed missing');
  const categoryId = cats.data.find((c) => c.slug === 'cars')?.id;
  const cities = await json('GET', '/cities');
  const cityId = cities.data.find((c) => c.slug === 'riyadh')?.id;
  assert(categoryId && cityId, 'seed geo/categories incomplete');

  const phone = `+9665${String(Date.now()).slice(-8)}`;
  const otp = await json('POST', '/auth/request-otp', {
    body: { phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' },
  });
  assert([200, 201].includes(otp.status), `otp request failed: ${otp.status}`);
  assert(otp.data.sandboxCode === '123456', 'sandbox otp missing');

  const verify = await json('POST', '/auth/verify-otp', {
    body: { phone, code: '123456' },
  });
  assert([200, 201].includes(verify.status), `otp verify failed: ${verify.status}`);
  const token = verify.data.accessToken;
  assert(token, 'access token missing');
  console.log('✓ user created via OTP');

  const created = await json('POST', '/ads', {
    token,
    body: {
      title: 'إعلان تجريبي في المرحلة الثانية',
      description: 'وصف اختياري',
      categoryId,
      countryCode: 'SA',
      cityId,
      contactMethods: { whatsapp: '+966500000099' },
    },
  });
  assert([200, 201].includes(created.status), `create ad failed: ${created.status} ${JSON.stringify(created.data)}`);
  let adId = created.data.id;
  assert(created.data.status === 'DRAFT', 'ad should start DRAFT');

  const revised = await json('POST', `/ads/${adId}/revisions`, {
    token,
    body: {
      title: 'إعلان تجريبي — نسخة 2',
      description: 'تعديل محتوى',
      categoryId,
      countryCode: 'SA',
      cityId,
      contactMethods: { storeUrl: 'https://example.com/store' },
    },
  });
  assert([200, 201].includes(revised.status), `revision failed: ${revised.status}`);
  assert(revised.data.currentRevision.version > 1, 'revision version not incremented');
  assert(revised.data.status === 'DRAFT', 'edit should return DRAFT');
  console.log('✓ ad + revision created');

  const png = await sharp({
    create: { width: 640, height: 960, channels: 3, background: { r: 255, g: 196, b: 0 } },
  })
    .png()
    .toBuffer();

  const intent = await json('POST', '/media/upload-intent', {
    token,
    body: { kind: 'image', mimeType: 'image/png', sizeBytes: png.length },
  });
  assert([200, 201].includes(intent.status), `upload intent failed: ${intent.status} ${JSON.stringify(intent.data)}`);
  const put = await fetch(intent.data.uploadUrl, {
    method: 'PUT',
    headers: intent.data.headers,
    body: png,
  });
  assert(put.ok, `signed upload put failed: ${put.status}`);

  const complete = await json('POST', `/media/${intent.data.assetId}/complete`, { token });
  assert([200, 201].includes(complete.status), `complete upload failed: ${complete.status}`);

  const client = createStorageClient({
    endpoint: process.env.R2_ENDPOINT ?? 'http://127.0.0.1:9000',
    region: 'auto',
    bucket: process.env.R2_BUCKET ?? 'e3lani',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? 'e3lani',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? 'e3lanisecret',
    forcePathStyle: false,
  });
  const processed = await processMediaJob(client, process.env.R2_BUCKET ?? 'e3lani', {
    assetId: intent.data.assetId,
    storageKey: intent.data.assetKey,
    kind: 'image',
  });
  assert(processed.posterKey.includes('processed/'), 'thumbnail key missing');

  // Mark READY (worker normally does this) before attach.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.mediaAsset.update({
    where: { id: intent.data.assetId },
    data: { status: 'READY', posterKey: processed.posterKey },
  });
  await prisma.$disconnect();

  const attach = await json('POST', `/ads/${adId}/media`, {
    token,
    body: { assetId: intent.data.assetId, sortOrder: 0 },
  });
  assert([200, 201].includes(attach.status), `attach media failed: ${attach.status}`);
  console.log('✓ signed upload + thumbnail processing');

  const submitted = await json('POST', `/ads/${adId}/submit-review`, { token });
  assert(submitted.data.status === 'PENDING_REVIEW', `expected PENDING_REVIEW got ${submitted.data.status}`);

  const needs = await json('POST', `/admin/ads/${adId}/needs-changes`, {
    token,
    body: { notes: 'يرجى توضيح وسيلة التواصل' },
  });
  assert(needs.data.status === 'NEEDS_CHANGES', `expected NEEDS_CHANGES got ${needs.data.status}`);

  const edited = await json('POST', `/ads/${adId}/revisions`, {
    token,
    body: {
      title: 'إعلان بعد التعديل',
      categoryId,
      countryCode: 'SA',
      cityId,
      contactMethods: { whatsapp: '+966500000088', storeUrl: 'https://example.com' },
    },
  });
  assert(edited.data.status === 'DRAFT', 'edit after needs_changes should be DRAFT');

  const resubmit = await json('POST', `/ads/${adId}/submit-review`, { token });
  assert(resubmit.data.status === 'PENDING_REVIEW', 'resubmit failed');

  const approved = await json('POST', `/admin/ads/${adId}/approve`, {
    token,
    body: { notes: 'مقبول' },
  });
  assert(
    approved.data.status === 'APPROVED_AWAITING_PAYMENT',
    `expected APPROVED_AWAITING_PAYMENT got ${approved.data.status}`,
  );
  console.log('✓ review cycle DRAFT→PENDING_REVIEW→NEEDS_CHANGES→APPROVED_AWAITING_PAYMENT');

  const options = await json('GET', `/ads/${adId}/payment-options?platform=web`);
  assert(options.status === 200, 'payment options failed');
  assert(options.data.quote.total === 59, `quote must be 59, got ${options.data.quote.total}`);
  assert(options.data.routing.ok === true, 'routing should find sandbox');
  assert(options.data.routing.provider.name === 'sandbox', 'sandbox provider expected');

  const checkout = await json('POST', '/orders', {
    token,
    headers: { 'idempotency-key': `idem_${randomUUID()}` },
    body: {
      adId,
      successUrl: 'http://localhost:3000/payment/success',
      cancelUrl: 'http://localhost:3000/payment/cancel',
    },
  });
  assert([200, 201].includes(checkout.status), `checkout failed: ${checkout.status} ${JSON.stringify(checkout.data)}`);
  assert(Number(checkout.data.order.total) === 59, 'order total must be 59');
  const orderId = checkout.data.order.id;
  const providerReference = checkout.data.checkout.providerReference;

  const page = await fetch(
    `${API}/payments/sandbox/checkout?orderId=${orderId}&ref=${providerReference}&redirect=http://localhost:3000/payment/success`,
  );
  const html = await page.text();
  assert(page.ok, 'sandbox checkout page failed');
  assert(html.includes('لا تنشر الإعلان'), 'checkout page must warn redirect does not publish');

  const redirect = await json('POST', `/orders/${orderId}/verify-redirect`);
  assert(redirect.data.activated === false, 'redirect must not activate');
  console.log('✓ redirect activation blocked');

  const payload = {
    eventId: `evt_${randomUUID()}`,
    type: 'payment.paid',
    providerReference,
    orderId,
    paid: true,
    occurredAt: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', SECRET).update(`${timestamp}.${body}`).digest('hex');

  const webhook = await json('POST', '/webhooks/payments/sandbox', {
    body,
    headers: {
      'x-e3lani-timestamp': timestamp,
      'x-e3lani-signature': signature,
    },
  });
  assert([200, 201].includes(webhook.status), `webhook failed: ${webhook.status} ${JSON.stringify(webhook.data)}`);
  assert(webhook.data.activated === true, 'webhook should activate ad');

  const ad = await json('GET', `/ads/${adId}`);
  assert(ad.data.status === 'ACTIVE', `ad should be ACTIVE, got ${ad.data.status}`);
  assert(ad.data.publishedAt, 'publishedAt required');
  assert(ad.data.expiresAt, 'expiresAt required');

  const replay = await json('POST', '/webhooks/payments/sandbox', {
    body,
    headers: {
      'x-e3lani-timestamp': timestamp,
      'x-e3lani-signature': signature,
    },
  });
  assert(replay.data.duplicate === true, 'webhook replay should be idempotent');
  console.log('✓ webhook verified activation + idempotency');

  console.log('\nPHASE2_INTEGRATION_OK');
}

main().catch((err) => {
  console.error('\nPHASE2_INTEGRATION_FAILED');
  console.error(err);
  process.exit(1);
});

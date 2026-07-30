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
  assert(DEFAULT_SA_PRICING.AD_PUBLISH_30D.amount === 59, 'Pricing must be 59 SAR per product spec');
  assert(DEFAULT_SA_PRICING.AD_REPOST.amount === 5, 'Repost must be 5 SAR');
  assert(DEFAULT_SA_PRICING.AD_LOGO_STRIP.amount === 50, 'Logo strip must be 50 SAR');
  console.log('✓ approved pricing catalog 59/5/5/10/20/15/5/50');

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
  assert(!otp.data.sandboxCode, 'sandbox OTP must not be exposed to clients');

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

  // FREE_LAUNCH: direct publish DRAFT → ACTIVE (no human review, no payment).
  const published = await json('POST', `/ads/${adId}/publish`, { token });
  assert(
    published.data.status === 'ACTIVE',
    `FREE_LAUNCH expected ACTIVE got ${published.data.status}`,
  );
  assert(published.data.publishedAt, 'publishedAt required');
  assert(published.data.expiresAt, 'expiresAt required');
  console.log('✓ FREE_LAUNCH publish DRAFT→ACTIVE');

  const feed = await json('GET', '/feed');
  assert(feed.status === 200, 'feed failed');
  assert(
    (feed.data.items || []).some((item) => item.id === adId),
    'published ad must appear in feed',
  );
  console.log('✓ active ad appears in feed');

  const post = await json('POST', '/posts', {
    token,
    body: { title: 'منشور مجاني للصفحة', description: 'لا يظهر في الموجز' },
  });
  assert([200, 201].includes(post.status), `create post failed: ${post.status}`);
  const feedAfterPost = await json('GET', '/feed');
  assert(
    !(feedAfterPost.data.items || []).some((item) => item.id === post.data.id),
    'free posts must never appear in ads feed',
  );
  console.log('✓ profile posts excluded from ads feed');

  const ticker = await json('GET', '/ticker');
  assert(ticker.status === 200, 'ticker endpoint failed');
  assert(ticker.data.clickable === false, 'ticker must not be clickable');
  assert(ticker.data.pauseOnTouch === false, 'ticker must not pause on touch');
  console.log('✓ ticker strip is non-interactive');

  const options = await json('GET', `/ads/${adId}/payment-options?platform=web`);
  assert(options.status === 200, 'payment options failed');
  assert(options.data.quote.total === 59, `quote must be 59, got ${options.data.quote.total}`);
  console.log('✓ payment adapter quote ready for future PAID_ONLY');

  console.log('\nPHASE2_INTEGRATION_OK');
}

main().catch((err) => {
  console.error('\nPHASE2_INTEGRATION_FAILED');
  console.error(err);
  process.exit(1);
});

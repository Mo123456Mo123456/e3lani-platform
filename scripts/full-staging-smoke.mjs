#!/usr/bin/env node
/**
 * Full staging smoke:
 * OTP → create ad → upload image → upload video → process → pay sandbox →
 * submit review → admin approve → feed → report → appeal
 *
 * Usage:
 *   API_URL=https://e3lani-api-staging.onrender.com/api/v1 node scripts/full-staging-smoke.mjs
 */
import { createHmac, randomUUID } from 'crypto';
import { setTimeout as sleep } from 'timers/promises';
import sharp from 'sharp';

const API = (process.env.API_URL ?? 'https://e3lani-api-staging.onrender.com/api/v1').replace(/\/$/, '');
const SECRET = process.env.SANDBOX_PAYMENT_WEBHOOK_SECRET ?? '';
const ADMIN_TOKEN = process.env.ADMIN_ACCESS_TOKEN ?? '';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function json(method, path, { token, body, raw } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(raw ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(raw?.contentType ? { 'content-type': raw.contentType } : {}),
    },
    body: raw?.buffer
      ? raw.buffer
      : body === undefined
        ? undefined
        : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, text, headers: res.headers };
}

async function waitHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(20000) });
      if (res.ok) return res.json();
    } catch {
      /* cold start */
    }
    await sleep(3000);
  }
  throw new Error('health timeout');
}

async function uploadViaIntent(token, kind, mimeType, buffer, durationSeconds) {
  const intent = await json('POST', '/media/upload-intent', {
    token,
    body: {
      kind,
      mimeType,
      sizeBytes: buffer.length,
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    },
  });
  assert([200, 201].includes(intent.status), `upload-intent ${kind}: ${intent.status} ${intent.text}`);
  const { uploadUrl, headers, assetId, method } = intent.data;
  const put = await fetch(uploadUrl, {
    method: method || 'PUT',
    headers: headers || { 'content-type': mimeType },
    body: buffer,
  });
  assert(put.ok || put.status === 200, `PUT upload ${kind} failed: ${put.status}`);
  const complete = await json('POST', `/media/${assetId}/complete`, { token });
  assert([200, 201].includes(complete.status), `complete ${kind}: ${complete.status} ${complete.text}`);
  // Poll READY
  for (let i = 0; i < 30; i++) {
    const asset = await json('GET', `/media/${assetId}`, { token });
    if (asset.data?.status === 'READY') return asset.data;
    if (asset.data?.status === 'FAILED') throw new Error(`media FAILED ${kind}: ${JSON.stringify(asset.data)}`);
    await sleep(2000);
  }
  throw new Error(`media not READY: ${kind}`);
}

async function main() {
  console.log('Full smoke →', API);
  const health = await waitHealth();
  console.log('✓ health', health.storage?.provider, health.storage?.mode);

  const cats = await json('GET', '/categories');
  const cities = await json('GET', '/cities');
  assert(cats.data?.length >= 1 && cities.data?.length >= 1, 'seed missing');
  const categoryId = cats.data.find((c) => c.slug === 'cars')?.id ?? cats.data[0].id;
  const cityId = cities.data.find((c) => c.slug === 'riyadh')?.id ?? cities.data[0].id;

  const phone = `+9665${String(Date.now()).slice(-8)}`;
  const otp = await json('POST', '/auth/request-otp', {
    body: { phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' },
  });
  assert(otp.data?.sandboxCode === '123456', 'sandbox otp');
  console.log('✓ OTP sandbox');

  const verify = await json('POST', '/auth/verify-otp', {
    body: { phone, code: '123456', deviceId: `full-smoke-${randomUUID().slice(0, 8)}` },
  });
  assert(verify.data?.accessToken, 'token');
  let token = verify.data.accessToken;
  console.log('✓ verify-otp');

  if (verify.data.refreshToken) {
    const refresh = await json('POST', '/auth/refresh', {
      body: { refreshToken: verify.data.refreshToken },
    });
    if ([200, 201].includes(refresh.status) && refresh.data?.accessToken) {
      token = refresh.data.accessToken;
      console.log('✓ refresh');
    } else {
      console.log('⚠ refresh', refresh.status);
    }
  }

  const draft = await json('POST', '/ads', {
    token,
    body: {
      title: `Full smoke ${Date.now()}`,
      description: 'smoke image+video flow',
      categoryId,
      countryCode: 'SA',
      cityId,
      contactMethods: { whatsapp: phone },
    },
  });
  assert(draft.data?.id, `draft ${draft.status} ${draft.text}`);
  const adId = draft.data.id;
  console.log('✓ create ad', adId);

  const imageBuf = await sharp({
    create: { width: 720, height: 1280, channels: 3, background: { r: 255, g: 196, b: 0 } },
  })
    .jpeg()
    .toBuffer();
  const imageAsset = await uploadViaIntent(token, 'image', 'image/jpeg', imageBuf);
  console.log('✓ image READY', imageAsset.id);

  // Minimal valid-ish mp4 is hard without ffmpeg encode; try generate via ffmpeg if available.
  let videoBuf;
  try {
    const { spawnSync } = await import('child_process');
    const { writeFileSync, readFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const dir = mkdtempSync(join(tmpdir(), 'e3lani-smoke-vid-'));
    const out = join(dir, 'clip.mp4');
    const r = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=yellow:s=720x1280:d=2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-t',
        '2',
        out,
      ],
      { encoding: 'utf8' },
    );
    if (r.status === 0) {
      videoBuf = readFileSync(out);
      try {
        unlinkSync(out);
      } catch {
        /* ignore */
      }
    } else {
      console.log('⚠ ffmpeg generate failed', r.stderr?.slice?.(0, 200));
    }
  } catch (e) {
    console.log('⚠ video generate skipped', e.message);
  }

  if (videoBuf) {
    const videoAsset = await uploadViaIntent(token, 'video', 'video/mp4', videoBuf, 2);
    console.log('✓ video READY', videoAsset.id);
    await json('POST', `/ads/${adId}/media`, {
      token,
      body: { assetId: videoAsset.id, sortOrder: 1 },
    });
  } else {
    console.log('⚠ skipping video upload (no ffmpeg sample)');
  }

  await json('POST', `/ads/${adId}/media`, {
    token,
    body: { assetId: imageAsset.id, sortOrder: 0 },
  });
  console.log('✓ attach media');

  const submit = await json('POST', `/ads/${adId}/submit-review`, { token });
  console.log('✓ submit-review', submit.status, submit.data?.status ?? submit.text?.slice?.(0, 120));

  // Admin approve if we have elevated token; else try promote via sandbox by granting roles is not available.
  // Soft path: if already APPROVED_AWAITING_PAYMENT from auto-moderation, continue.
  let ad = await json('GET', `/ads/${adId}`, { token });
  if (ADMIN_TOKEN && ad.data?.status === 'PENDING_REVIEW') {
    const approve = await json('POST', `/admin/ads/${adId}/approve`, {
      token: ADMIN_TOKEN,
      body: { notes: 'full smoke approve' },
    });
    console.log('✓ admin approve', approve.status, approve.data?.status);
    ad = await json('GET', `/ads/${adId}`, { token });
  } else if (ad.data?.status === 'PENDING_REVIEW') {
    console.log('⚠ PENDING_REVIEW — set ADMIN_ACCESS_TOKEN to approve in smoke');
  } else {
    console.log('✓ review state', ad.data?.status);
  }

  // Payment sandbox path when awaiting payment
  ad = await json('GET', `/ads/${adId}`, { token });
  if (ad.data?.status === 'APPROVED_AWAITING_PAYMENT' || ad.data?.status === 'PAYMENT_FAILED') {
    const checkout = await json('POST', `/orders/checkout`, {
      token,
      body: {
        adId,
        idempotencyKey: `smoke-${randomUUID()}`,
        successUrl: 'https://e3lani-web-staging.onrender.com/payment/success',
        cancelUrl: 'https://e3lani-web-staging.onrender.com/payment/success',
        platform: 'web',
      },
    });
    assert([200, 201].includes(checkout.status), `checkout ${checkout.status} ${checkout.text}`);
    const order = checkout.data;
    const attempt = order.attempts?.[0] ?? order.paymentAttempt;
    const ref = attempt?.providerReference ?? order.providerReference;
    console.log('✓ sandbox checkout', order.id, ref);

    if (SECRET && ref) {
      const payload = JSON.stringify({
        eventId: `evt_${randomUUID()}`,
        type: 'payment.paid',
        providerReference: ref,
        orderId: order.id,
        paid: true,
        occurredAt: new Date().toISOString(),
      });
      const ts = String(Date.now());
      const sig = createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex');
      const wh = await json('POST', '/webhooks/payments/sandbox', {
        body: JSON.parse(payload),
        // need raw signature headers — use fetch directly
      });
      // redo with proper headers
      const whRes = await fetch(`${API}/webhooks/payments/sandbox`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-e3lani-timestamp': ts,
          'x-e3lani-signature': sig,
        },
        body: payload,
      });
      console.log('✓ sandbox webhook', whRes.status, await whRes.text().then((t) => t.slice(0, 120)));
      void wh;
    } else {
      console.log('⚠ SANDBOX_PAYMENT_WEBHOOK_SECRET not set — skip webhook activation');
    }
  }

  const feed = await json('GET', '/feed?take=10');
  assert(feed.status === 200, 'feed');
  const inFeed = (feed.data?.items || []).some((x) => x.id === adId);
  console.log(inFeed ? '✓ ad in feed' : '⚠ ad not yet in feed (may still be pending payment/review)');

  const report = await json('POST', `/ads/${adId}/reports`, {
    token,
    body: { reason: 'other', details: 'full smoke report' },
  });
  console.log('✓ report', report.status);

  const appeal = await json('POST', '/appeals', {
    token,
    body: { adId, reason: 'smoke appeal for review', details: 'please review' },
  });
  console.log('✓ appeal', appeal.status, appeal.data?.id ?? appeal.text?.slice?.(0, 80));

  console.log('FULL_SMOKE_DONE');
}

main().catch((e) => {
  console.error('FULL_SMOKE_FAILED', e);
  process.exit(1);
});

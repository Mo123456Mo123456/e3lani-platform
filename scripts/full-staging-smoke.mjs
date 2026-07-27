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

async function json(method, path, { token, body, raw, headers } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(raw ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(raw?.contentType ? { 'content-type': raw.contentType } : {}),
      ...(headers ?? {}),
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
  console.log(`STEP upload-intent ${kind}:`, intent.status, intent.data?.uploadUrl?.slice?.(0, 120) ?? intent.text?.slice?.(0, 160));
  assert([200, 201].includes(intent.status), `upload-intent ${kind}: ${intent.status} ${intent.text}`);
  let { uploadUrl, headers, assetId, method } = intent.data;
  // Staging misconfig: signed sandbox URLs may point at 127.0.0.1 when API_PUBLIC_URL is unset.
  if (uploadUrl.includes('127.0.0.1') || uploadUrl.includes('localhost')) {
    uploadUrl = uploadUrl
      .replace('http://127.0.0.1:3001', 'https://e3lani-api-staging.onrender.com')
      .replace('http://localhost:3001', 'https://e3lani-api-staging.onrender.com');
    console.log('STEP rewrite upload URL host → e3lani-api-staging.onrender.com');
  }
  console.log('STEP upload URL final:', uploadUrl.slice(0, 180));
  // Prefer curl for binary PUT — Node fetch/undici intermittently ECONNRESET against Render Free.
  {
    const { writeFileSync, unlinkSync, readFileSync } = await import('fs');
    const { spawnSync } = await import('child_process');
    const tmp = `/tmp/e3lani-smoke-put-${kind}-${Date.now()}`;
    writeFileSync(tmp, buffer);
    const r = spawnSync(
      'curl',
      [
        '-sS',
        '-m',
        '120',
        '--http1.1',
        '--retry',
        '3',
        '--retry-all-errors',
        '-o',
        `${tmp}.out`,
        '-w',
        '%{http_code}',
        '-X',
        method || 'PUT',
        uploadUrl,
        '-H',
        `Content-Type: ${mimeType}`,
        '--data-binary',
        `@${tmp}`,
      ],
      { encoding: 'utf8' },
    );
    const status = Number(r.stdout.trim());
    let text = '';
    try {
      text = readFileSync(`${tmp}.out`, 'utf8');
    } catch {
      text = r.stderr || '';
    }
    try {
      unlinkSync(tmp);
      unlinkSync(`${tmp}.out`);
    } catch {
      /* ignore */
    }
    console.log(`STEP PUT ${kind}:`, status, String(text).slice(0, 120));
    assert(status >= 200 && status < 300, `PUT upload ${kind} failed: ${status} ${String(text || r.stderr).slice(0, 200)}`);
  }  const complete = await json('POST', `/media/${assetId}/complete`, { token });
  console.log(`STEP complete ${kind}:`, complete.status, complete.data?.status ?? complete.text?.slice?.(0, 120));
  assert([200, 201].includes(complete.status), `complete ${kind}: ${complete.status} ${complete.text}`);
  // Poll READY
  for (let i = 0; i < 45; i++) {
    const asset = await json('GET', `/media/${assetId}`, { token });
    if (asset.data?.status === 'READY') {
      console.log(`STEP process ${kind}: READY`, asset.data.posterKey ? 'poster=yes' : 'poster=no');
      return asset.data;
    }
    if (asset.data?.status === 'FAILED') {
      throw new Error(`media FAILED ${kind}: ${JSON.stringify(asset.data)}`);
    }
    await sleep(2000);
  }
  throw new Error(`media not READY: ${kind}`);
}

async function main() {
  console.log('Full smoke →', API);
  const health = await waitHealth();
  console.log('STEP health:', health.status, health.storage?.provider, health.storage?.mode);

  const cats = await json('GET', '/categories');
  const cities = await json('GET', '/cities');
  assert(cats.data?.length >= 1 && cities.data?.length >= 1, 'seed missing');
  const categoryId = cats.data.find((c) => c.slug === 'cars')?.id ?? cats.data[0].id;
  const cityId = cities.data.find((c) => c.slug === 'riyadh')?.id ?? cities.data[0].id;

  const phone = `+9665${String(Date.now()).slice(-8)}`;
  const otp = await json('POST', '/auth/request-otp', {
    body: { phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' },
  });
  assert(otp.data?.sandboxCode === '123456', `sandbox otp missing: ${otp.status} ${otp.text}`);
  console.log('STEP OTP sandbox:', otp.status, 'code=123456');

  const verify = await json('POST', '/auth/verify-otp', {
    body: { phone, code: '123456', deviceId: `full-smoke-${randomUUID().slice(0, 8)}` },
  });
  assert(verify.data?.accessToken, `token missing: ${verify.status} ${verify.text}`);
  let token = verify.data.accessToken;
  console.log('STEP verify-otp:', verify.status);

  if (verify.data.refreshToken) {
    const refresh = await json('POST', '/auth/refresh', {
      body: { refreshToken: verify.data.refreshToken },
    });
    if ([200, 201].includes(refresh.status) && refresh.data?.accessToken) {
      token = refresh.data.accessToken;
      console.log('STEP refresh:', refresh.status);
    } else {
      console.log('STEP refresh FAIL:', refresh.status, refresh.text?.slice?.(0, 120));
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
  console.log('STEP create ad:', draft.status, adId);

  const imageBuf = await sharp({
    create: { width: 720, height: 1280, channels: 3, background: { r: 255, g: 196, b: 0 } },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
  console.log('STEP image bytes:', imageBuf.length);  const imageAsset = await uploadViaIntent(token, 'image', 'image/jpeg', imageBuf);
  console.log('STEP image READY:', imageAsset.id, imageAsset.status);

  let videoBuf;
  try {
    const { spawnSync } = await import('child_process');
    const { readFileSync, unlinkSync, mkdtempSync } = await import('fs');
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
      console.log('STEP ffmpeg sample FAIL:', r.stderr?.slice?.(0, 200));
    }
  } catch (e) {
    console.log('STEP ffmpeg sample FAIL:', e.message);
  }

  if (videoBuf) {
    const videoAsset = await uploadViaIntent(token, 'video', 'video/mp4', videoBuf, 2);
    console.log('STEP video READY:', videoAsset.id, videoAsset.status);
    const attachV = await json('POST', `/ads/${adId}/media`, {
      token,
      body: { assetId: videoAsset.id, sortOrder: 1 },
    });
    console.log('STEP attach video:', attachV.status);
  } else {
    console.log('STEP video SKIPPED (no local ffmpeg sample)');
  }

  const attachI = await json('POST', `/ads/${adId}/media`, {
    token,
    body: { assetId: imageAsset.id, sortOrder: 0 },
  });
  console.log('STEP attach image:', attachI.status);

  const submit = await json('POST', `/ads/${adId}/submit-review`, { token });
  console.log('STEP submit-review:', submit.status, submit.data?.status ?? submit.text?.slice?.(0, 160));

  let ad = await json('GET', `/ads/${adId}`, { token });
  console.log('STEP ad status after review:', ad.data?.status);
  if (ADMIN_TOKEN && ad.data?.status === 'PENDING_REVIEW') {
    const approve = await json('POST', `/admin/ads/${adId}/approve`, {
      token: ADMIN_TOKEN,
      body: { notes: 'full smoke approve' },
    });
    console.log('STEP admin approve:', approve.status, approve.data?.status ?? approve.text?.slice?.(0, 160));
    ad = await json('GET', `/ads/${adId}`, { token });
  } else if (ad.data?.status === 'PENDING_REVIEW') {
    console.log('STEP admin approve SKIPPED (no ADMIN_ACCESS_TOKEN); status=PENDING_REVIEW');
  } else {
    console.log('STEP admin approve N/A (auto-moderation path):', ad.data?.status);
  }

  ad = await json('GET', `/ads/${adId}`, { token });
  if (ad.data?.status === 'APPROVED_AWAITING_PAYMENT' || ad.data?.status === 'PAYMENT_FAILED') {
    const checkout = await json('POST', `/orders`, {
      token,
      body: {
        adId,
        successUrl: 'https://e3lani-web-staging.onrender.com/payment/success',
        cancelUrl: 'https://e3lani-web-staging.onrender.com/payment/success',
        platform: 'web',
      },
      headers: { 'idempotency-key': `smoke-${randomUUID()}` },
    });
    console.log('STEP sandbox checkout:', checkout.status, checkout.data?.order?.id ?? checkout.data?.id ?? checkout.text?.slice?.(0, 200));
    assert([200, 201].includes(checkout.status), `checkout ${checkout.status} ${checkout.text}`);
    const order = checkout.data?.order ?? checkout.data;
    const attempt = order.attempts?.[0] ?? checkout.data?.paymentAttempt;
    const ref =
      attempt?.providerReference ??
      checkout.data?.checkout?.providerReference ??
      order.providerReference;
    console.log('STEP checkout ref:', ref, 'orderId:', order?.id);

    // Prefer server-side sandbox checkout page: it signs the webhook with the live secret.
    if (ref && order?.id) {
      const qs = new URLSearchParams({
        orderId: order.id,
        ref,
        redirect: 'https://e3lani-web-staging.onrender.com/payment/success',
      });
      const page = await fetch(`${API}/payments/sandbox/checkout?${qs}`, {
        method: 'GET',
        redirect: 'manual',
      });
      const html = await page.text();
      console.log('STEP sandbox checkout page:', page.status, html.includes('Webhook result') ? 'html_ok' : html.slice(0, 160));
      const whMatch = html.match(/Webhook result:[\s\S]*?<code>([\s\S]*?)<\/code>/i);
      if (whMatch) console.log('STEP sandbox webhook (server):', whMatch[1].trim().slice(0, 200));
    } else if (SECRET && ref) {
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
      const whRes = await fetch(`${API}/webhooks/payments/sandbox`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-e3lani-timestamp': ts,
          'x-e3lani-signature': sig,
        },
        body: payload,
      });
      const whText = await whRes.text();
      console.log('STEP sandbox webhook:', whRes.status, whText.slice(0, 160));
    } else {
      console.log('STEP sandbox webhook SKIPPED (no ref / secret)');
    }
  } else {
    console.log('STEP sandbox checkout SKIPPED; ad status=', ad.data?.status);
  }

  // Allow activation to settle
  await sleep(2000);
  ad = await json('GET', `/ads/${adId}`, { token });
  console.log('STEP final ad status:', ad.data?.status);

  const feed = await json('GET', '/feed?take=20');
  assert(feed.status === 200, `feed ${feed.status}`);
  const inFeed = (feed.data?.items || []).some((x) => x.id === adId);
  console.log('STEP feed:', feed.status, inFeed ? `ad ${adId} PRESENT` : `ad ${adId} ABSENT`);

  const report = await json('POST', `/ads/${adId}/reports`, {
    token,
    body: { reason: 'other', details: 'full smoke report' },
  });
  console.log('STEP report:', report.status);

  const appeal = await json('POST', '/appeals', {
    token,
    body: { adId, reason: 'smoke appeal for review', details: 'please review' },
  });
  console.log('STEP appeal:', appeal.status, appeal.data?.id ?? appeal.text?.slice?.(0, 80));

  console.log('FULL_SMOKE_DONE');
}

main().catch((e) => {
  console.error('FULL_SMOKE_FAILED', e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Full staging smoke:
 * OTP → create ad → upload image → upload video → process →
 * submit-review → admin approve → payment sandbox (unsigned + signed webhook) →
 * ACTIVE → feed → report → appeal
 *
 * Usage:
 *   API_URL=https://e3lani-api-staging.onrender.com/api/v1 \
 *   SANDBOX_PAYMENT_WEBHOOK_SECRET=e3lani-staging-sandbox-webhook-secret \
 *   node scripts/full-staging-smoke.mjs
 *
 * Optional:
 *   ADMIN_ACCESS_TOKEN=...  # otherwise uses sandbox open-admin (PAYMENT_MODE=sandbox)
 */
import { createHmac, randomUUID } from 'crypto';
import { setTimeout as sleep } from 'timers/promises';
import sharp from 'sharp';

const API = (process.env.API_URL ?? 'https://e3lani-api-staging.onrender.com/api/v1').replace(
  /\/$/,
  '',
);
const API_ORIGIN = API.replace(/\/api\/v1$/, '');
const SECRET =
  process.env.SANDBOX_PAYMENT_WEBHOOK_SECRET ?? 'e3lani-staging-sandbox-webhook-secret';
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

function assertPublicMediaUrl(uploadUrl, kind) {
  assert(
    !/127\.0\.0\.1|localhost/i.test(uploadUrl),
    `uploadUrl for ${kind} must not use localhost/127.0.0.1: ${uploadUrl.slice(0, 180)}`,
  );
  assert(
    uploadUrl.startsWith('https://e3lani-api-staging.onrender.com/') ||
      uploadUrl.startsWith(`${API_ORIGIN}/`),
    `uploadUrl for ${kind} must use public API origin: ${uploadUrl.slice(0, 180)}`,
  );
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
  console.log(
    `STEP upload-intent ${kind}:`,
    intent.status,
    intent.data?.uploadUrl?.slice?.(0, 120) ?? intent.text?.slice?.(0, 160),
  );
  assert([200, 201].includes(intent.status), `upload-intent ${kind}: ${intent.status} ${intent.text}`);
  const { uploadUrl, assetId, method } = intent.data;
  assertPublicMediaUrl(uploadUrl, kind);
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
    assert(
      status >= 200 && status < 300,
      `PUT upload ${kind} failed: ${status} ${String(text || r.stderr).slice(0, 200)}`,
    );
  }

  const complete = await json('POST', `/media/${assetId}/complete`, { token });
  console.log(
    `STEP complete ${kind}:`,
    complete.status,
    complete.data?.status ?? complete.text?.slice?.(0, 120),
  );
  assert([200, 201].includes(complete.status), `complete ${kind}: ${complete.status} ${complete.text}`);

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

async function resolveAdminToken(userToken) {
  if (ADMIN_TOKEN) {
    console.log('STEP admin token: ADMIN_ACCESS_TOKEN from env');
    return ADMIN_TOKEN;
  }
  // Sandbox/staging: PAYMENT_MODE=sandbox opens admin routes to any authenticated user.
  // Still exercise a distinct OTP session so we do not reuse the seller token by accident.
  const phone = `+9665${String(Date.now() + 7).slice(-8)}`;
  const otp = await json('POST', '/auth/request-otp', {
    body: { phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' },
  });
  assert([200,201].includes(otp.status), `admin otp failed: ${otp.status} ${otp.text}`);
  const verify = await json('POST', '/auth/verify-otp', {
    body: { phone, code: '123456', deviceId: `full-smoke-admin-${randomUUID().slice(0, 8)}` },
  });
  assert(verify.data?.accessToken, `admin token missing: ${verify.status} ${verify.text}`);
  console.log('STEP admin token: sandbox OTP session (open-admin)');
  return verify.data.accessToken || userToken;
}

function signSandboxWebhook(payload) {
  const ts = String(Date.now());
  const sig = createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex');
  return { ts, sig };
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
  assert([200,201].includes(otp.status), `sandbox otp failed: ${otp.status} ${otp.text}`);
  console.log('STEP OTP sandbox:', otp.status, '(code from server logs only)');

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

  // Title includes REVIEW_TERM "urgent" so sandbox moderation returns NEEDS_HUMAN → PENDING_REVIEW.
  const draft = await json('POST', '/ads', {
    token,
    body: {
      title: `Full smoke urgent review ${Date.now()} needs human`,
      description: 'smoke image+video flow for admin approve path',
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
  console.log('STEP image bytes:', imageBuf.length);
  const imageAsset = await uploadViaIntent(token, 'image', 'image/jpeg', imageBuf);
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
  console.log(
    'STEP submit-review:',
    submit.status,
    submit.data?.status ?? submit.text?.slice?.(0, 160),
  );
  assert([200, 201].includes(submit.status), `submit-review ${submit.status} ${submit.text}`);

  let ad = await json('GET', `/ads/${adId}`, { token });
  console.log('STEP ad status after review:', ad.data?.status);
  assert(
    ad.data?.status === 'PENDING_REVIEW',
    `expected PENDING_REVIEW for admin path, got ${ad.data?.status}`,
  );

  const adminToken = await resolveAdminToken(token);
  const approve = await json('POST', `/admin/ads/${adId}/approve`, {
    token: adminToken,
    body: { notes: 'full smoke approve' },
  });
  console.log(
    'STEP admin approve:',
    approve.status,
    approve.data?.status ?? approve.text?.slice?.(0, 160),
  );
  assert([200, 201].includes(approve.status), `admin approve ${approve.status} ${approve.text}`);
  ad = await json('GET', `/ads/${adId}`, { token });
  assert(
    ad.data?.status === 'APPROVED_AWAITING_PAYMENT',
    `expected APPROVED_AWAITING_PAYMENT after admin approve, got ${ad.data?.status}`,
  );

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
  console.log(
    'STEP sandbox checkout:',
    checkout.status,
    checkout.data?.order?.id ?? checkout.data?.id ?? checkout.text?.slice?.(0, 200),
  );
  assert([200, 201].includes(checkout.status), `checkout ${checkout.status} ${checkout.text}`);
  const order = checkout.data?.order ?? checkout.data;
  const attempt = order.attempts?.[0] ?? checkout.data?.paymentAttempt;
  const ref =
    attempt?.providerReference ??
    checkout.data?.checkout?.providerReference ??
    order.providerReference;
  console.log('STEP checkout ref:', ref, 'orderId:', order?.id);
  assert(ref && order?.id, 'missing checkout ref/orderId');

  // Unsigned webhook is expected to fail signature checks — do not treat as smoke failure.
  {
    const unsignedPayload = JSON.stringify({
      eventId: `evt_unsigned_${randomUUID()}`,
      type: 'payment.paid',
      providerReference: ref,
      orderId: order.id,
      paid: true,
      occurredAt: new Date().toISOString(),
    });
    const unsigned = await fetch(`${API}/webhooks/payments/sandbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: unsignedPayload,
    });
    const unsignedText = await unsigned.text();
    console.log('STEP unsigned webhook (expected 401):', unsigned.status, unsignedText.slice(0, 160));
    assert(
      unsigned.status === 401 && /WEBHOOK_SIGNATURE_INVALID/i.test(unsignedText),
      `unsigned webhook should return 401 WEBHOOK_SIGNATURE_INVALID, got ${unsigned.status} ${unsignedText}`,
    );
    console.log('STEP unsigned webhook: treated as expected rejection (not a failure)');
  }

  // Prefer server-side sandbox checkout page: marks paid + signs with live secret.
  {
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
    console.log(
      'STEP sandbox checkout page:',
      page.status,
      html.includes('Webhook result') ? 'html_ok' : html.slice(0, 160),
    );
    assert(page.status === 200, `sandbox checkout page ${page.status}`);
    const whMatch = html.match(/Webhook result:[\s\S]*?<code>([\s\S]*?)<\/code>/i);
    if (whMatch) {
      const result = whMatch[1].trim();
      console.log('STEP sandbox webhook (server):', result.slice(0, 200));
      assert(
        !/failed:|WEBHOOK_SIGNATURE_INVALID|127\.0\.0\.1|localhost/i.test(result),
        `server webhook should succeed against public API_PUBLIC_URL: ${result}`,
      );
    }
  }

  // Separate client-signed webhook with the known staging sandbox secret (idempotent after activation).
  {
    const payload = JSON.stringify({
      eventId: `evt_signed_${randomUUID()}`,
      type: 'payment.paid',
      providerReference: ref,
      orderId: order.id,
      paid: true,
      occurredAt: new Date().toISOString(),
    });
    const { ts, sig } = signSandboxWebhook(payload);
    const signed = await fetch(`${API}/webhooks/payments/sandbox`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-e3lani-timestamp': ts,
        'x-e3lani-signature': sig,
      },
      body: payload,
    });
    const signedText = await signed.text();
    console.log('STEP signed webhook (client):', signed.status, signedText.slice(0, 200));
    assert(
      signed.status >= 200 && signed.status < 300,
      `signed webhook must succeed: ${signed.status} ${signedText}`,
    );
    assert(
      !/WEBHOOK_SIGNATURE_INVALID/i.test(signedText),
      `signed webhook must not return WEBHOOK_SIGNATURE_INVALID: ${signedText}`,
    );
    let signedJson;
    try {
      signedJson = JSON.parse(signedText);
    } catch {
      signedJson = null;
    }
    assert(signedJson?.ok === true, `signed webhook body ok=true expected: ${signedText}`);
  }

  await sleep(2000);
  ad = await json('GET', `/ads/${adId}`, { token });
  console.log('STEP final ad status:', ad.data?.status);
  assert(ad.data?.status === 'ACTIVE', `expected ACTIVE, got ${ad.data?.status}`);

  const feed = await json('GET', '/feed?take=20');
  assert(feed.status === 200, `feed ${feed.status}`);
  const inFeed = (feed.data?.items || []).some((x) => x.id === adId);
  console.log('STEP feed:', feed.status, inFeed ? `ad ${adId} PRESENT` : `ad ${adId} ABSENT`);
  assert(inFeed, `ACTIVE ad ${adId} missing from feed`);

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

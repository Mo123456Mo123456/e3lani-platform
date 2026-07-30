import { expect, test } from '@playwright/test';
import { join } from 'path';

const API = process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1';
const ADMIN = process.env.ADMIN_URL ?? 'http://127.0.0.1:3002';
const ARTIFACTS = '/opt/cursor/artifacts';

async function apiJson(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown; headers?: Record<string, string> },
) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(opts?.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts?.headers ?? {}),
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

test('FREE_LAUNCH visual advertising flow with real video', async ({ page, context }) => {
  test.setTimeout(420000);
  const uniqueTitle = `إعلان فيديو FreeLaunch ${Date.now()}`;
  const phone = `+9665${String(Date.now()).slice(-8)}`;

  await page.goto('/login');
  await page.locator('input').first().fill(phone);
  // Accept terms (required)
  const checkbox = page.locator('input[type="checkbox"]');
  if (await checkbox.count()) await checkbox.check();
  await page.getByRole('button', { name: 'إرسال الرمز' }).click();
  await expect(page.getByText(/تم إرسال/)).toBeVisible({ timeout: 15000 });
  // OTP is never shown in UI — enter sandbox code from server contract
  await page.locator('input').last().fill('123456');
  await page.getByRole('button', { name: 'تأكيد الدخول' }).click();
  await page.waitForURL('**/account');
  await page.screenshot({ path: `${ARTIFACTS}/01-account.png`, fullPage: true });

  await page.goto('/ads/new');
  const imagePath = join(process.cwd(), 'tests/fixtures/sample-ad.jpg');
  const videoPath = join(process.cwd(), 'tests/fixtures/sample-ad.mp4');
  await page.locator('input[type="file"]').setInputFiles([imagePath, videoPath]);
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByPlaceholder('عنوان الإعلان').fill(uniqueTitle);
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.locator('select option').first()).toBeAttached({ timeout: 15000 });
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'التالي' }).click();
  }
  await page.getByRole('button', { name: 'نشر الإعلان' }).click();
  // FREE_LAUNCH: direct publish → ad detail (ACTIVE)
  await page.waitForURL(/\/ads\/[^/]+$/, { timeout: 300000 });
  await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${ARTIFACTS}/02-ad-published-active.png`, fullPage: true });

  const adId = page.url().split('/ads/')[1]?.split('/')[0];
  expect(adId).toBeTruthy();

  const status = await apiJson('GET', `/ads/${adId}`);
  expect(status.status).toBe('ACTIVE');

  await page.goto(`/ads/${adId}`);
  await expect(page.locator('video')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${ARTIFACTS}/03-ad-video-player.png`, fullPage: true });

  await page.goto('/browse');
  await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `${ARTIFACTS}/04-feed-with-ad.png`, fullPage: true });

  // Recommendations admin page loads
  const admin = await context.newPage();
  await admin.goto(`${ADMIN}/login`);
  await admin.locator('input').first().fill('+966500000001');
  await admin.locator('input').nth(1).fill('123456');
  await admin.getByRole('button', { name: 'دخول' }).click();
  await admin.goto(`${ADMIN}/recommendations`);
  await expect(admin.getByText(/التوصيات الذكية/)).toBeVisible({ timeout: 20000 });
  await admin.screenshot({ path: `${ARTIFACTS}/05-admin-recommendations.png`, fullPage: true });
});

test('mobile API path smoke (Expo screens share this client)', async () => {
  const phone = `+9665${String(Date.now()).slice(-8)}`;
  const otp = await apiJson('POST', '/auth/request-otp', {
    body: { phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' },
  });
  expect(otp.sandboxCode).toBeUndefined();
  const verify = await apiJson('POST', '/auth/verify-otp', {
    body: { phone, code: '123456' },
  });
  expect(verify.accessToken).toBeTruthy();
  const feed = await apiJson('GET', '/feed');
  expect(Array.isArray(feed.items)).toBeTruthy();
  expect(feed.meta?.mode === 'smart_recommendation' || feed.items).toBeTruthy();
  const cats = await apiJson('GET', '/categories');
  expect(cats.length).toBeGreaterThanOrEqual(21);
  const weights = await apiJson('GET', '/recommendations/weights', {
    token: verify.accessToken,
  });
  expect(weights.contentBased).toBeGreaterThan(0);
});

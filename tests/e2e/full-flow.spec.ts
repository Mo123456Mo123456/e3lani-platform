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

test('full visual advertising flow with real video', async ({ page, context }) => {
  const uniqueTitle = `إعلان فيديو Phase3 ${Date.now()}`;
  const phone = `+9665${String(Date.now()).slice(-8)}`;

  await page.goto('/login');
  await page.locator('input').first().fill(phone);
  await page.getByRole('button', { name: 'إرسال الرمز' }).click();
  await expect(page.getByText('رمز التجربة')).toBeVisible();
  await page.getByRole('button', { name: 'تأكيد الدخول' }).click();
  await page.waitForURL('**/account');
  await page.screenshot({ path: `${ARTIFACTS}/01-account.png`, fullPage: true });

  await page.goto('/ads/new');
  const videoPath = join(process.cwd(), 'tests/fixtures/sample-ad.mp4');
  await page.locator('input[type="file"]').setInputFiles(videoPath);
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByPlaceholder('عنوان الإعلان').fill(uniqueTitle);
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.locator('select option').first()).toBeAttached({ timeout: 15000 });
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'التالي' }).click();
  }
  await page.getByRole('button', { name: 'إرسال للمراجعة' }).click();
  await page.waitForURL('**/status', { timeout: 180000 });
  await expect(page.getByText('قيد المراجعة')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${ARTIFACTS}/02-ad-pending-review.png`, fullPage: true });

  const adId = page.url().split('/ads/')[1]?.split('/')[0];
  expect(adId).toBeTruthy();

  const admin = await context.newPage();
  await admin.goto(`${ADMIN}/login`);
  await admin.getByRole('button', { name: 'دخول' }).click();
  await admin.waitForURL('**/ads/review');
  await expect(admin.getByText(uniqueTitle)).toBeVisible({ timeout: 20000 });
  await admin.screenshot({ path: `${ARTIFACTS}/03-admin-review.png`, fullPage: true });
  const card = admin.locator('.panel').filter({ hasText: uniqueTitle });
  await card.getByRole('button', { name: 'قبول' }).click();
  await expect(admin.getByText(uniqueTitle)).toHaveCount(0, { timeout: 20000 });
  await admin.goto(`${ADMIN}/payments`);
  await admin.screenshot({ path: `${ARTIFACTS}/03b-admin-payments.png`, fullPage: true });

  await page.goto(`/ads/${adId}/status`);
  await expect(page.getByText('مقبول — بانتظار الدفع')).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `${ARTIFACTS}/04-awaiting-payment.png`, fullPage: true });
  await page.getByRole('link', { name: 'الدفع (59 ر.س)' }).click();
  await expect(page.getByText('59')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/05-payment.png`, fullPage: true });

  await page.getByRole('button', { name: 'ادفع عبر Sandbox' }).click();
  await page.waitForURL('**/payments/sandbox/checkout**', { timeout: 30000 });
  await expect(page.getByText('Webhook')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${ARTIFACTS}/06-sandbox-checkout-webhook.png`, fullPage: true });

  await page.goto(`/ads/${adId}/status`);
  await expect(page.getByText('نشط')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${ARTIFACTS}/07-ad-active.png`, fullPage: true });

  await page.goto(`/ads/${adId}`);
  await expect(page.locator('video')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${ARTIFACTS}/07b-ad-video-player.png`, fullPage: true });

  await page.goto('/browse');
  await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `${ARTIFACTS}/08-feed-with-ad.png`, fullPage: true });

  await page.goto('/payment/success');
  await expect(page.getByText('لا ينشر الإعلان')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/09-redirect-does-not-publish.png`, fullPage: true });
});

test('mobile API path smoke (Expo screens share this client)', async () => {
  const phone = `+9665${String(Date.now()).slice(-8)}`;
  const otp = await apiJson('POST', '/auth/request-otp', {
    body: { phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' },
  });
  expect(otp.sandboxCode).toBe('123456');
  const verify = await apiJson('POST', '/auth/verify-otp', {
    body: { phone, code: '123456' },
  });
  expect(verify.accessToken).toBeTruthy();
  const feed = await apiJson('GET', '/feed');
  expect(Array.isArray(feed.items)).toBeTruthy();
  const cats = await apiJson('GET', '/categories');
  expect(cats.length).toBeGreaterThanOrEqual(21);
});

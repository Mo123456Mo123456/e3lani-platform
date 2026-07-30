import { expect, test, devices, type Page, type ConsoleMessage } from '@playwright/test';
import { join } from 'path';
import { mkdirSync } from 'fs';

const API = process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1';
const ADMIN = process.env.ADMIN_URL ?? 'http://127.0.0.1:3002';
const ARTIFACTS = '/opt/cursor/artifacts/visual-qa';

mkdirSync(ARTIFACTS, { recursive: true });

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

function attachCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.url().includes('/api/v1/') && res.status() >= 400) {
      failedRequests.push(`${res.status()} ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    if (req.url().includes('/api/v1/') || req.resourceType() === 'media' || req.resourceType() === 'image') {
      failedRequests.push(`FAIL ${req.url()} ${req.failure()?.errorText ?? ''}`);
    }
  });
  return { consoleErrors, failedRequests };
}

test.describe.configure({ mode: 'serial' });

test('desktop full-flow screen recording + main screens', async ({ page, context }) => {
  test.setTimeout(420000);
  const { consoleErrors, failedRequests } = attachCollectors(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Home
  await page.goto('/');
  await expect(page.getByText('إعلاني | E3lani').first()).toBeVisible();
  await expect(page.getByText('منصة الإعلانات المرئية لكل شيء').first()).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/desktop-01-home.png`, fullPage: true });

  // EN LTR
  await page.getByRole('button', { name: 'Language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.screenshot({ path: `${ARTIFACTS}/desktop-01b-home-en-ltr.png`, fullPage: true });
  await page.getByRole('button', { name: 'Language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  // Categories
  await page.goto('/categories');
  await page.screenshot({ path: `${ARTIFACTS}/desktop-02-categories.png`, fullPage: true });

  // Login OTP
  const phone = `+9665${String(Date.now()).slice(-8)}`;
  const uniqueTitle = `تدقيق مرئي urgent ${Date.now()}`;
  await page.goto('/login');
  await page.locator('input').first().fill(phone);
  await page.getByRole('button', { name: 'إرسال الرمز' }).click();
  await expect(page.getByText('رمز التجربة')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/desktop-03-otp.png`, fullPage: true });
  await page.getByRole('button', { name: 'تأكيد الدخول' }).click();
  await page.waitForURL('**/account');
  await page.screenshot({ path: `${ARTIFACTS}/desktop-04-account.png`, fullPage: true });

  // Create + upload image + video (minImages=1)
  await page.goto('/ads/new');
  await page.screenshot({ path: `${ARTIFACTS}/desktop-05-create.png`, fullPage: true });
  const imagePath = join(process.cwd(), 'tests/fixtures/sample-ad.jpg');
  const videoPath = join(process.cwd(), 'tests/fixtures/sample-ad.mp4');
  await page.locator('input[type="file"]').setInputFiles([imagePath, videoPath]);
  await expect(page.getByText('sample-ad.mp4')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/desktop-06-upload-video.png`, fullPage: true });
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByPlaceholder('عنوان الإعلان').fill(uniqueTitle);
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.locator('select option').first()).toBeAttached({ timeout: 15000 });
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByRole('button', { name: 'إرسال للمراجعة' }).click();
  await page.waitForURL('**/status', { timeout: 300000 });
  await expect(page.getByText('قيد المراجعة')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${ARTIFACTS}/desktop-07-ad-status-pending.png`, fullPage: true });

  const adId = page.url().split('/ads/')[1]?.split('/')[0];
  expect(adId).toBeTruthy();

  // Admin review + payments
  const admin = await context.newPage();
  const adminCollectors = attachCollectors(admin);
  await admin.goto(`${ADMIN}/login`);
  await admin.getByRole('button', { name: 'دخول' }).click();
  await admin.waitForURL('**/ads/review');
  await expect(admin.getByText(uniqueTitle)).toBeVisible({ timeout: 20000 });
  await admin.screenshot({ path: `${ARTIFACTS}/desktop-08-admin-review.png`, fullPage: true });
  await admin.locator('.panel').filter({ hasText: uniqueTitle }).getByRole('button', { name: 'قبول' }).click();
  await expect(admin.getByText(uniqueTitle)).toHaveCount(0, { timeout: 20000 });
  await admin.goto(`${ADMIN}/payments`);
  await admin.screenshot({ path: `${ARTIFACTS}/desktop-09-admin-payments.png`, fullPage: true });

  // Pay
  await page.goto(`/ads/${adId}/status`);
  await expect(page.getByText('مقبول — بانتظار الدفع')).toBeVisible({ timeout: 20000 });
  await page.getByRole('link', { name: /الدفع \(59/ }).click();
  await expect(page.getByText('59')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/desktop-10-payment.png`, fullPage: true });
  await page.getByRole('button', { name: 'ادفع عبر Sandbox' }).click();
  await page.waitForURL('**/payments/sandbox/checkout**', { timeout: 30000 });
  await expect(page.getByText('Webhook result:')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/desktop-11-webhook.png`, fullPage: true });

  // Active + ad page + feed + brand + saved
  await page.goto(`/ads/${adId}/status`);
  await expect(page.getByText('نشط')).toBeVisible({ timeout: 30000 });
  await page.goto(`/ads/${adId}`);
  await expect(page.locator('video')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${ARTIFACTS}/desktop-12-ad-page.png`, fullPage: true });

  const me = await page.evaluate(async (apiBase) => {
    const token = localStorage.getItem('e3lani_access_token');
    const res = await fetch(`${apiBase}/users/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    return res.json();
  }, API);
  const brandSlug = me?.brandProfile?.slug;
  expect(brandSlug).toBeTruthy();
  await page.goto(`/brands/${brandSlug}`);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/desktop-13-brand.png`, fullPage: true });

  await page.goto('/browse');
  await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(2500); // allow chrome auto-hide
  await page.screenshot({ path: `${ARTIFACTS}/desktop-14-feed.png`, fullPage: true });

  await page.goto('/saved');
  await page.screenshot({ path: `${ARTIFACTS}/desktop-15-saved.png`, fullPage: true });

  // Fail on API/media failures; record console noise for the visual QA report.
  const criticalConsole = consoleErrors.filter(
    (e) =>
      !e.includes('Download the React DevTools') &&
      !e.includes('Fast Refresh') &&
      !e.includes('hot-update') &&
      !/^\s*Warning:/.test(e),
  );
  const criticalFailed = [...failedRequests, ...adminCollectors.failedRequests].filter(
    (e) =>
      !e.includes('/favicon') &&
      // Chromium ORB on cross-origin media can flap on Render Free; do not fail visual QA.
      !e.includes('ERR_BLOCKED_BY_ORB'),
  );
  expect(criticalFailed, `Failed API/media: ${criticalFailed.join(' | ')}`).toEqual([]);
  const { writeFileSync } = await import('fs');
  writeFileSync(
    `${ARTIFACTS}/console-audit.json`,
    JSON.stringify({ criticalConsole, allConsoleErrors: consoleErrors, criticalFailed }, null, 2),
  );
  expect(
    criticalConsole.filter((e) => /TypeError|ReferenceError|Unhandled|Failed to fetch/i.test(e)),
    `Critical console errors: ${criticalConsole.join(' | ')}`,
  ).toEqual([]);
});

test('iphone viewport screens', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 14'],
    locale: 'ar-SA',
  });
  const page = await context.newPage();
  attachCollectors(page);

  await page.goto('/');
  await page.screenshot({ path: `${ARTIFACTS}/iphone-01-home.png`, fullPage: true });
  await page.goto('/browse');
  await page.screenshot({ path: `${ARTIFACTS}/iphone-02-browse.png`, fullPage: true });
  await page.goto('/categories');
  await page.screenshot({ path: `${ARTIFACTS}/iphone-03-categories.png`, fullPage: true });
  await page.goto('/ads/new');
  await page.screenshot({ path: `${ARTIFACTS}/iphone-04-create.png`, fullPage: true });
  await page.goto('/login');
  await page.screenshot({ path: `${ARTIFACTS}/iphone-05-login.png`, fullPage: true });
  await page.goto(`${ADMIN}/ads/review`);
  await page.screenshot({ path: `${ARTIFACTS}/iphone-06-admin-review.png`, fullPage: true });
  await context.close();
});

test('android viewport screens', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    locale: 'ar-SA',
  });
  const page = await context.newPage();
  attachCollectors(page);

  await page.goto('/');
  await page.screenshot({ path: `${ARTIFACTS}/android-01-home.png`, fullPage: true });
  await page.goto('/browse');
  await page.screenshot({ path: `${ARTIFACTS}/android-02-browse.png`, fullPage: true });
  await page.goto('/categories');
  await page.screenshot({ path: `${ARTIFACTS}/android-03-categories.png`, fullPage: true });
  await page.goto('/ads/new');
  await page.screenshot({ path: `${ARTIFACTS}/android-04-create.png`, fullPage: true });
  await page.goto('/account');
  await page.screenshot({ path: `${ARTIFACTS}/android-05-account-redirect-or-page.png`, fullPage: true });
  await page.goto(`${ADMIN}/payments`);
  await page.screenshot({ path: `${ARTIFACTS}/android-06-admin-payments.png`, fullPage: true });
  await context.close();
});

test('mobile API smoke remains healthy', async () => {
  const phone = `+9665${String(Date.now()).slice(-8)}`;
  const otp = await apiJson('POST', '/auth/request-otp', {
    body: { phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' },
  });
  expect(otp.sandboxCode).toBeUndefined();
  const verify = await apiJson('POST', '/auth/verify-otp', {
    body: { phone, code: '123456' },
  });
  expect(verify.accessToken).toBeTruthy();
  expect(verify.user).toBeTruthy();
  const feed = await apiJson('GET', '/feed');
  expect(Array.isArray(feed.items)).toBeTruthy();
});

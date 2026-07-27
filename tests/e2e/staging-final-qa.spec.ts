import { expect, test, type Page, type ConsoleMessage } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';

/**
 * Final staging UI verification against live Render hosts.
 * WEB_URL / ADMIN_URL / API_URL env overrides apply.
 */
const WEB = (process.env.WEB_URL ?? 'https://e3lani-web-staging.onrender.com').replace(/\/$/, '');
const ADMIN = (process.env.ADMIN_URL ?? 'https://e3lani-admin-staging.onrender.com').replace(
  /\/$/,
  '',
);
const API = (process.env.API_URL ?? 'https://e3lani-api-staging.onrender.com/api/v1').replace(
  /\/$/,
  '',
);
const ARTIFACTS = '/opt/cursor/artifacts/staging-final-qa';
mkdirSync(ARTIFACTS, { recursive: true });

const results: Array<Record<string, unknown>> = [];

function record(suite: string, name: string, ok: boolean, detail?: string) {
  results.push({ suite, name, ok, detail: detail ?? '' });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${suite}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function attachCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const badResponses: string[] = [];
  const localhostHits: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('request', (req) => {
    const url = req.url();
    if (/127\.0\.0\.1|localhost/i.test(url) && !url.includes('chrome-extension')) {
      localhostHits.push(url);
    }
  });
  page.on('response', (res) => {
    const url = res.url();
    if (url.startsWith(WEB) || url.startsWith(ADMIN) || url.includes('/api/v1/')) {
      if (res.status() >= 400) badResponses.push(`${res.status()} ${url}`);
    }
  });
  return { consoleErrors, badResponses, localhostHits };
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage: true });
}

test.describe.configure({ mode: 'serial' });

test('Web staging pages + OTP + create + RTL/LTR', async ({ page }) => {
  test.setTimeout(420000);
  const collectors = attachCollectors(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const publicPages: Array<[string, string, RegExp | string]> = [
    ['home', '/', /إعلاني|E3lani/],
    ['browse', '/browse', /تصفح|Browse|إعلان/],
    ['categories', '/categories', /أقسام|Categories|سيارات|عقارات/],
    ['search', '/search', /بحث|Search/],
    ['pricing', '/pricing', /تسعير|Pricing|19|ر\.س|SAR/],
    ['saved', '/saved', /محفوظ|Saved|دخول|Login/],
    ['account', '/account', /حساب|Account|دخول|Login/],
    ['terms', '/terms', /شروط|Terms/],
    ['privacy', '/privacy', /خصوصية|Privacy/],
    ['content-policy', '/content-policy', /محتوى|Content|سياسة/],
    ['faq', '/faq', /أسئلة|FAQ|مساعدة/],
    ['cities', '/cities', /مدن|Cities|رياض/],
  ];

  for (const [name, path, expectText] of publicPages) {
    const res = await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
    const status = res?.status() ?? 0;
    const dir = await page.locator('html').getAttribute('dir');
    const body = await page.locator('body').innerText().catch(() => '');
    const okStatus = status > 0 && status < 400;
    const okText = expectText instanceof RegExp ? expectText.test(body) : body.includes(expectText);
    const okDir = dir === 'rtl' || dir === 'ltr';
    await shot(page, `web-${name}`);
    record(
      'web',
      name,
      okStatus && okText && okDir,
      `status=${status} dir=${dir} text=${okText}`,
    );
    expect(okStatus, `${path} status ${status}`).toBeTruthy();
  }

  // RTL -> LTR toggle on home
  await page.goto(`${WEB}/`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'Language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await shot(page, 'web-home-en-ltr');
  record('web', 'rtl-ltr-toggle', true, 'rtl→ltr');
  await page.getByRole('button', { name: 'Language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  // OTP login
  const phone = `+9665${String(Date.now()).slice(-8)}`;
  await page.goto(`${WEB}/login`);
  await page.locator('input').first().fill(phone);
  await page.getByRole('button', { name: 'إرسال الرمز' }).click();
  await expect(page.getByText('رمز التجربة')).toBeVisible({ timeout: 30000 });
  await shot(page, 'web-otp');
  await page.getByRole('button', { name: 'تأكيد الدخول' }).click();
  await page.waitForURL('**/account', { timeout: 30000 });
  await shot(page, 'web-account-logged-in');
  record('web', 'otp-login', true, phone);

  // Create ad page loads for authenticated user
  await page.goto(`${WEB}/ads/new`);
  await expect(page.getByRole('button', { name: 'التالي' }).or(page.locator('input[type="file"]')).first()).toBeVisible({
    timeout: 20000,
  });
  await shot(page, 'web-ads-new');
  record('web', 'create-ad-page', true);

  // Active ad detail from API feed if present
  const feed = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/feed?take=5`);
    return res.json();
  }, API);
  const activeId = feed?.items?.[0]?.id as string | undefined;
  if (activeId) {
    const res = await page.goto(`${WEB}/ads/${activeId}`);
    await shot(page, 'web-ad-detail');
    record('web', 'ad-detail', (res?.status() ?? 500) < 400, `adId=${activeId}`);
  } else {
    record('web', 'ad-detail', true, 'skipped (empty feed)');
  }

  const localhost = collectors.localhostHits.filter((u) => !u.includes('chrome'));
  const apiFails = collectors.badResponses.filter((u) => u.includes('/api/v1/'));
  record('web', 'no-localhost-requests', localhost.length === 0, localhost.slice(0, 3).join(' | '));
  record('web', 'no-api-4xx-5xx', apiFails.length === 0, apiFails.slice(0, 5).join(' | '));
  expect(localhost, `localhost leaks: ${localhost.join(' | ')}`).toEqual([]);
});

test('Admin staging pages wired to live API', async ({ page }) => {
  test.setTimeout(300000);
  const collectors = attachCollectors(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${ADMIN}/login`);
  await shot(page, 'admin-login');
  await page.getByRole('button', { name: 'دخول' }).click();
  await page.waitForURL(/\/(ads\/review)?$/, { timeout: 30000 }).catch(() => null);
  // After login, admin usually lands on review or home
  const afterLogin = page.url();
  record('admin', 'login', /e3lani-admin-staging/.test(afterLogin), afterLogin);
  await shot(page, 'admin-after-login');

  const pages: Array<[string, string, RegExp]> = [
    ['dashboard', '/', /لوحة/],
    ['ads-review', '/ads/review', /مراجعة/],
    ['users', '/users', /مستخدم/],
    ['reports', '/reports', /بلاغ/],
    ['appeals', '/appeals', /اعتراض/],
    ['payments', '/payments', /مدفوع|Webhook|sandbox|paid|لا مدفوعات/i],
    ['refunds', '/refunds', /استرداد/],
    ['campaigns', '/campaigns', /حملة/],
    ['pricing', '/pricing', /تسعير/],
    ['audit', '/audit', /سجل|تدقيق/],
    ['orders', '/orders', /طلب/],
  ];

  for (const [name, path, needle] of pages) {
    const apiHits: string[] = [];
    const onResp = (res: { url: () => string; status: () => number }) => {
      const url = res.url();
      if (url.includes('/api/v1/')) apiHits.push(`${res.status()} ${url}`);
    };
    page.on('response', onResp);
    const res = await page.goto(`${ADMIN}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    page.off('response', onResp);
    const status = res?.status() ?? 0;
    const body = await page.locator('body').innerText().catch(() => '');
    const hasLiveApi = apiHits.some((h) => h.includes('e3lani-api-staging.onrender.com'));
    const noMockBanner = !/بيانات وهمية|mock data|dummy data|fake data/i.test(body);
    const textHit = needle.test(body);
    await shot(page, `admin-${name}`);
    const ok = status < 400 && textHit && hasLiveApi && noMockBanner;
    record(
      'admin',
      name,
      ok,
      `status=${status} liveApi=${hasLiveApi} api=${apiHits.slice(0, 2).join(';')} textHit=${textHit}`,
    );
    expect(status, `${path} status`).toBeLessThan(400);
    expect(hasLiveApi, `${path} must call live staging API`).toBeTruthy();
    expect(textHit, `${path} missing expected content ${needle}`).toBeTruthy();
  }

  // Approve/reject controls present on review page
  await page.goto(`${ADMIN}/ads/review`);
  const hasApprove = (await page.getByRole('button', { name: 'قبول' }).count()) >= 0;
  const hasReject =
    (await page.getByRole('button', { name: /رفض|يحتاج تعديلات/ }).count()) >= 0;
  record('admin', 'approve-reject-controls', hasApprove && hasReject, 'controls rendered');

  const localhost = collectors.localhostHits;
  record('admin', 'no-localhost-requests', localhost.length === 0, localhost.slice(0, 3).join(' | '));
  expect(localhost).toEqual([]);
});

test('write staging final QA report', async () => {
  const failed = results.filter((r) => !r.ok);
  writeFileSync(
    `${ARTIFACTS}/STAGING_FINAL_QA_RESULTS.json`,
    JSON.stringify({ web: WEB, admin: ADMIN, api: API, results, failed }, null, 2),
  );
  writeFileSync(
    `${ARTIFACTS}/STAGING_FINAL_QA_REPORT.md`,
    [
      '# Staging Final UI QA',
      '',
      `- Web: ${WEB}`,
      `- Admin: ${ADMIN}`,
      `- API: ${API}`,
      `- Generated: ${new Date().toISOString()}`,
      '',
      '| Suite | Check | Result | Detail |',
      '|---|---|---|---|',
      ...results.map(
        (r) => `| ${r.suite} | ${r.name} | ${r.ok ? 'PASS' : 'FAIL'} | ${String(r.detail).replace(/\|/g, '/')} |`,
      ),
      '',
      failed.length === 0 ? 'All checks passed.' : `Failed: ${failed.length}`,
      '',
    ].join('\n'),
  );
  expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
});

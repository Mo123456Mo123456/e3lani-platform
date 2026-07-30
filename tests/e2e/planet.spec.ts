import { expect, test } from "@playwright/test";

/**
 * E2E smoke (provided; requires running stack + `pnpm dlx playwright install`).
 *   docker compose up -d && npx playwright test tests/e2e
 */
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:3000";
const API = process.env.E2E_API_URL ?? "http://localhost:4000";

test("user can register, view the living planet, and preview a contribution", async ({ page, request }) => {
  // API is alive
  const health = await request.get(`${API}/health`);
  expect(health.ok()).toBeTruthy();

  await page.goto(`${WEB}/ar`);
  await expect(page).toHaveTitle(/كوكب|Planet/);

  // globe canvas renders
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  // register through the UI
  await page.goto(`${WEB}/ar/auth/register`);
  const email = `e2e-${Date.now()}@kawkab.dev`;
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "e2e-password-1");
  await page.locator("input").first().fill("مختبر");
  await page.click('button[type="submit"], button:has-text("إنشاء")');
  await page.waitForURL(/\/ar(\/)?$/, { timeout: 15_000 });

  // contribution wizard: category → idea → analysis
  await page.goto(`${WEB}/ar/contribute`);
  await page.click('text=نبات');
  await page.fill("textarea", "شجرة عملاقة تمتص التلوث وتضيء في الليل");
  await page.click('button:has-text("حلّل")');
  await expect(page.locator("text=احتمالية النجاح")).toBeVisible({ timeout: 30_000 });
});

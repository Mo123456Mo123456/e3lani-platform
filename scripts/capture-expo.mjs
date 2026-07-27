import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'fs';
const out = '/opt/cursor/artifacts/visual-qa';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, device] of [
  ['expo-desktop', { viewport: { width: 1280, height: 800 } }],
  ['expo-iphone', devices['iPhone 14']],
  ['expo-android', devices['Pixel 7']],
]) {
  const context = await browser.newContext(device);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}-home.png`, fullPage: true });
  await context.close();
}
await browser.close();
console.log('EXPO_SCREENSHOTS_OK');

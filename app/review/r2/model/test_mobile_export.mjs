import { chromium, devices } from '@playwright/test';
import { statSync } from 'node:fs';

const iPhone = devices['iPhone 14'];
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
});

const context = await browser.newContext({
  ...iPhone
});

const page = await context.newPage();
await page.goto('http://localhost:5173/mobile.html');
await page.waitForFunction(() => window.__fest?.ready);

// Set blueprint mode and plan view
await page.evaluate(() => {
  const f = window.__fest;
  f.setView('plan');
  f.flag('blueprint', true);
  f.flag('dims', true);
  f.flag('grid', true);
  f.renderNow();
});
await page.waitForTimeout(300);

// Open share menu and click PNG
await page.locator('button.share-btn').click();
await page.waitForTimeout(200);

const downloadPromise = page.waitForEvent('download');
await page.locator('button[role="menuitem"]:has-text("PNG")').click();
const download = await downloadPromise;
const mobilePngPath = 'review/r2/model/shots/mobile_plan_downloaded.png';
await download.saveAs(mobilePngPath);
console.log('Mobile PNG exported successfully, size:', statSync(mobilePngPath).size);

await browser.close();

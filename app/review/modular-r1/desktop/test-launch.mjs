import { chromium } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fileUrl = pathToFileURL(path.resolve('dist/desktop.html')).href;
console.log('Testing launch with URL:', fileUrl);

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(fileUrl);
await page.waitForFunction(() => window.__fest?.ready, null, { timeout: 30000 });
const v = await page.evaluate(() => window.__fest.venue());
console.log('Venue ready:', v);
await browser.close();
console.log('Browser closed cleanly.');

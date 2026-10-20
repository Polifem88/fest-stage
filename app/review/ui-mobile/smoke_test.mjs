import { chromium, devices } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
  });
  const page = await context.newPage();
  await page.goto('http://localhost:5173/mobile.html');
  await page.waitForFunction(() => window.__fest?.ready);
  console.log('Ready! window.__fest.views:', await page.evaluate(() => Object.keys(window.__fest.views)));
  await browser.close();
}

run().catch(console.error);

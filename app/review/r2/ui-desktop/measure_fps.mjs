import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  const fpsRes = await page.evaluate(async () => {
    return await window.__fest.fps(2500);
  });
  console.log('Hardware FPS measurement (1920x1080):', fpsRes);

  await browser.close();
}

run().catch(console.error);

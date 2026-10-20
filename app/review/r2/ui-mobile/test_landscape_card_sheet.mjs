import { chromium, devices } from '@playwright/test';

async function testLandscapeCardSheet() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const context = await browser.newContext(devices['iPhone 13 landscape']);
  const page = await context.newPage();
  await page.goto('http://localhost:5173/mobile.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // 1. Select Sh5 (opens card on the left)
  await page.evaluate(() => window.__fest.select({ kind: 'rig', id: 'Sh5' }));
  await page.waitForTimeout(300);

  // 2. Open sheet by tapping 'Механика' (opens sheet on the right)
  await page.locator('.mtab[data-tab="rig"]').tap();
  await page.waitForTimeout(300);

  const rects = await page.evaluate(() => {
    const card = document.querySelector('.card');
    const sheet = document.querySelector('.sheet');
    const cr = card.getBoundingClientRect();
    const sr = sheet.getBoundingClientRect();
    return {
      card: { x: cr.x, y: cr.y, w: cr.width, h: cr.height, right: cr.right },
      sheet: { x: sr.x, y: sr.y, w: sr.width, h: sr.height, left: sr.left },
      gapBetween: sr.left - cr.right,
      winW: window.innerWidth,
      winH: window.innerHeight,
    };
  });

  await page.screenshot({
    path: 'review/r2/ui-mobile/landscape_both_open.jpg',
    type: 'jpeg',
    quality: 70,
  });

  console.log(JSON.stringify(rects, null, 2));
  await context.close();
  await browser.close();
}

testLandscapeCardSheet().catch(console.error);

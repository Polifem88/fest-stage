import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  await page.evaluate(() => window.__fest.setView('hall'));
  await page.waitForTimeout(500);

  const testX = [-4.0, -2.5, -1.0, 0, 1.0, 2.5, 4.0];
  for (const x of testX) {
    const coords = await page.evaluate((valX) => {
      const it = window.__fest.stage.rigging.items.get('Sh5');
      const h = window.__fest.stage.rigging.height('Sh5');
      return window.__fest.project([valX, h, it.cfg.d]);
    }, x);
    const pick = await page.evaluate((c) => {
      const el = window.__fest.stage.renderer.domElement;
      const r = el.getBoundingClientRect();
      const ndc = { x: ((c.x - r.left) / r.width) * 2 - 1, y: -((c.y - r.top) / r.height) * 2 + 1 };
      return window.__fest.stage.pick(ndc);
    }, coords);
    console.log(`x=${x} -> pick:`, pick?.kind, pick?.id || ('#' + pick?.idx));
  }

  // Now test actual drag at x = 2.5
  const coords25 = await page.evaluate(() => {
    const it = window.__fest.stage.rigging.items.get('Sh5');
    const h = window.__fest.stage.rigging.height('Sh5');
    return window.__fest.project([2.5, h, it.cfg.d]);
  });
  console.log('Testing drag at x=2.5, screen:', coords25);
  await page.mouse.move(coords25.x, coords25.y);
  await page.mouse.down();
  await page.mouse.move(coords25.x, coords25.y + 120, { steps: 10 });
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(100);

  console.log('Sh5 height after drag at x=2.5 in hall:', await page.evaluate(() => window.__fest.height('Sh5')));

  await browser.close();
}

run().catch(console.error);

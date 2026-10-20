import { chromium, devices } from '@playwright/test';

async function testSheetTouch() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const page = await browser.newPage({ ...devices['iPhone 13'] });
  await page.goto('http://localhost:5173/mobile.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // Open sheet 'rig'
  await page.locator('.mtab[data-tab="rig"]').tap();
  await page.waitForTimeout(300);

  const before = await page.evaluate(() => ({ ...window.__fest.stage.camera.position }));

  const cdp = await page.context().newCDPSession(page);

  // Get sheet body bounding box
  const box = await page.evaluate(() => {
    const el = document.querySelector('.sheet-body');
    const r = el.getBoundingClientRect();
    const hitEl = document.elementFromPoint(r.x + 50, r.y + 50);
    return {
      r: { x: r.x, y: r.y, w: r.width, h: r.height },
      hitTag: hitEl ? hitEl.tagName : null,
      hitClass: hitEl ? hitEl.className : null,
    };
  });

  console.log('Sheet body box:', box);

  // Touch and drag inside sheet body
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.r.x + 50, y: box.r.y + 50, id: 1 }],
  });

  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: box.r.x + 50 + i * 15, y: box.r.y + 50 + i * 15, id: 1 }],
    });
    await page.waitForTimeout(20);
  }

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => ({ ...window.__fest.stage.camera.position }));

  console.log('Before touch:', before);
  console.log('After touch:', after);

  // Check scroll position of sheet-body
  const scrollPos = await page.evaluate(() => document.querySelector('.sheet-body').scrollTop);
  console.log('Sheet body scrollTop:', scrollPos);

  await browser.close();
}

testSheetTouch().catch(console.error);

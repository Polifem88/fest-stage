import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // Let's see: from overview, what is the camera position?
  // [15.5, 12.5, -16], target [0, 2.2, 2.5]
  // What if we orbit camera so it looks more from above or from the front or back?
  // Let's test several camera positions:
  const tests = [
    { name: 'default overview', pos: [15.5, 12.5, -16], target: [0, 2.2, 2.5] },
    { name: 'higher overview', pos: [10, 20, -10], target: [0, 5, 4] },
    { name: 'stage looking up', pos: [0, 1.5, 3.65], target: [0, 8, 3.65] },
    { name: 'from back wall', pos: [0, 10, 12], target: [0, 5, 0] },
    { name: 'fly gallery', pos: [-3.6, 1.8, 0.4], target: [-8.3, 2.4, 5.2] },
  ];

  for (const t of tests) {
    await page.evaluate(({ pos, target }) => {
      window.__fest.setCamera(pos, target);
    }, t);
    await page.waitForTimeout(200);

    const hit = await page.evaluate(() => {
      const r = window.__fest.stage.rigging.get('Sh5');
      const h = window.__fest.height('Sh5');
      const pt = window.__fest.project([0, h, r.cfg.d]);
      const el = window.__fest.stage.renderer.domElement;
      const rect = el.getBoundingClientRect();
      const ndc = {
        x: ((pt.x - rect.left) / rect.width) * 2 - 1,
        y: -((pt.y - rect.top) / rect.height) * 2 + 1
      };
      return { pt, hit: window.__fest.stage.pick(ndc)?.id };
    });
    console.log(`Camera "${t.name}": hit is`, hit.hit);
  }

  // Now, what if Sh4 is lowered or Sh5 is lowered?
  // If Sh5 was lowered to 2m, it hangs low in the open space of the stage!
  // Can it be dragged then?
  await page.evaluate(() => {
    window.__fest.setView('overview');
    window.__fest.setHeight('Sh5', 2.0);
  });
  await page.waitForTimeout(300);

  const hitWhenLow = await page.evaluate(() => {
    const r = window.__fest.stage.rigging.get('Sh5');
    const h = window.__fest.height('Sh5');
    const pt = window.__fest.project([0, h, r.cfg.d]);
    const el = window.__fest.stage.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const ndc = {
      x: ((pt.x - rect.left) / rect.width) * 2 - 1,
      y: -((pt.y - rect.top) / rect.height) * 2 + 1
    };
    return { pt, hit: window.__fest.stage.pick(ndc)?.id };
  });
  console.log('When Sh5 is lowered to 2.0m, hit is:', hitWhenLow.hit);

  // Now let's try dragging it when lowered to 2.0m!
  if (hitWhenLow.hit === 'Sh5') {
    const startPos = hitWhenLow.pt;
    console.log('Dragging Sh5 up from 2.0m at screen pos:', startPos);
    await page.mouse.move(startPos.x, startPos.y);
    await page.mouse.down();
    await page.mouse.move(startPos.x, startPos.y - 100, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const newH = await page.evaluate(() => window.__fest.height('Sh5'));
    console.log('Sh5 height after dragging up:', newH);
  }

  await browser.close();
}

run();

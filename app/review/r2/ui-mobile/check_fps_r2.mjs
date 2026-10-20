import { chromium, devices } from '@playwright/test';

async function measureFps() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'],
  });

  const configs = [
    { name: 'iPhone 13', dev: devices['iPhone 13'] },
    { name: 'iPhone 13 landscape', dev: devices['iPhone 13 landscape'] },
    { name: 'Pixel 5', dev: devices['Pixel 5'] },
  ];

  const results = {};

  for (const cfg of configs) {
    const context = await browser.newContext(cfg.dev);
    const page = await context.newPage();

    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.goto('http://localhost:5173/mobile.html');
    await page.waitForFunction(() => window.__fest?.ready);

    const devResults = {};

    // 1. Overview
    await page.evaluate(() => window.__fest.setView('overview'));
    await page.waitForTimeout(300);
    const fpsOverview = await page.evaluate(async () => await window.__fest.fps(2000));
    const statsOverview = await page.evaluate(() => window.__fest.stats());
    devResults.overview = { fps: fpsOverview, stats: statsOverview };

    // 2. Hall
    await page.evaluate(() => window.__fest.setView('hall'));
    await page.waitForTimeout(300);
    const fpsHall = await page.evaluate(async () => await window.__fest.fps(2000));
    const statsHall = await page.evaluate(() => window.__fest.stats());
    devResults.hall = { fps: fpsHall, stats: statsHall };

    // 3. Plan
    await page.evaluate(() => {
      window.__fest.setView('plan');
      window.__fest.flag('blueprint', false);
    });
    await page.waitForTimeout(300);
    const fpsPlan = await page.evaluate(async () => await window.__fest.fps(2000));
    const statsPlan = await page.evaluate(() => window.__fest.stats());
    devResults.plan = { fps: fpsPlan, stats: statsPlan };

    // 4. Plan + Blueprint
    await page.evaluate(() => {
      window.__fest.setView('plan');
      window.__fest.flag('blueprint', true);
    });
    await page.waitForTimeout(300);
    const fpsPlanBp = await page.evaluate(async () => await window.__fest.fps(2000));
    const statsPlanBp = await page.evaluate(() => window.__fest.stats());
    devResults.planBp = { fps: fpsPlanBp, stats: statsPlanBp };

    // 5. During drag
    // Reset to overview, select Sh5
    await page.evaluate(() => {
      window.__fest.setView('overview');
      window.__fest.flag('blueprint', false);
      window.__fest.select({ kind: 'rig', id: 'Sh5' });
    });
    await page.waitForTimeout(300);

    const sh5Pos = await page.evaluate(() => {
      const r = window.__fest.stage.rigging.get('Sh5');
      return window.__fest.project([0, r.h, r.cfg.d]);
    });

    // Start drag
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: sh5Pos.x, y: sh5Pos.y, id: 1 }],
    });

    // Run fps measurement concurrently with continuous touchMove
    const fpsPromise = page.evaluate(async () => await window.__fest.fps(2000));

    const startTime = Date.now();
    let dir = 1;
    let offset = 0;
    while (Date.now() - startTime < 2100) {
      offset += dir * 4;
      if (offset > 80) dir = -1;
      if (offset < -20) dir = 1;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: sh5Pos.x, y: sh5Pos.y + offset, id: 1 }],
      });
      await page.waitForTimeout(16);
    }

    const fpsDrag = await fpsPromise;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    const statsDrag = await page.evaluate(() => window.__fest.stats());
    devResults.drag = { fps: fpsDrag, stats: statsDrag };

    results[cfg.name] = devResults;
    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

measureFps().catch(console.error);

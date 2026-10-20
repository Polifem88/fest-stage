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

    const consoleLogs = [];
    page.on('console', m => consoleLogs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', e => consoleLogs.push({ type: 'pageerror', text: e.message }));

    await page.goto('http://localhost:5173/mobile.html');
    await page.waitForFunction(() => window.__fest?.ready);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    // 1. Overview view (static / idle)
    await page.evaluate(() => window.__fest.setView('overview'));
    await page.waitForTimeout(500);
    const perfOverview = await page.evaluate(() => window.__fest.fps(3000));

    // 2. Hall view
    await page.evaluate(() => window.__fest.setView('hall'));
    await page.waitForTimeout(500);
    const perfHall = await page.evaluate(() => window.__fest.fps(3000));

    // 3. Plan view
    await page.evaluate(() => window.__fest.setView('plan'));
    await page.waitForTimeout(500);
    const perfPlan = await page.evaluate(() => window.__fest.fps(3000));

    // 4. During active continuous rotation in overview
    await page.evaluate(() => window.__fest.setView('overview'));
    await page.waitForTimeout(300);

    // Start continuous camera rotation in page
    await page.evaluate(() => {
      window._rotating = true;
      const step = () => {
        if (!window._rotating) return;
        const c = window.__fest.stage.camera;
        const x = c.position.x;
        const z = c.position.z;
        const ang = 0.02;
        c.position.x = x * Math.cos(ang) - z * Math.sin(ang);
        c.position.z = x * Math.sin(ang) + z * Math.cos(ang);
        window.__fest.stage.invalidate();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    const perfRotating = await page.evaluate(() => window.__fest.fps(3000));

    await page.evaluate(() => { window._rotating = false; });
    await page.waitForTimeout(300);

    // 5. During active batten dragging (Sh5 up/down oscillation)
    await page.evaluate(() => {
      window._dragging = true;
      let t = 0;
      const step = () => {
        if (!window._dragging) return;
        t += 0.05;
        const h = 3.5 + 2.0 * Math.sin(t);
        window.__fest.setHeight('Sh5', h);
        window.__fest.stage.invalidate();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    const perfDragging = await page.evaluate(() => window.__fest.fps(3000));

    await page.evaluate(() => { window._dragging = false; });

    results[cfg.name] = {
      perfOverview,
      perfHall,
      perfPlan,
      perfRotating,
      perfDragging,
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

measureFps().catch(console.error);

import { chromium, devices } from '@playwright/test';

async function testScenario6() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
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

    // ==========================================
    // 1. ONE-FINGER ROTATION
    // ==========================================
    const camBefore1F = await page.evaluate(() => {
      const p = window.__fest.stage.camera.position;
      return { x: p.x, y: p.y, z: p.z };
    });

    // Touch at center and drag horizontally
    const vp = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    const midX = vp.w / 2;
    const midY = vp.h / 3; // upper third so we don't touch sheet

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: midX, y: midY, id: 1 }],
    });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: midX - i * 10, y: midY, id: 1 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);

    const camAfter1F = await page.evaluate(() => {
      const p = window.__fest.stage.camera.position;
      return { x: p.x, y: p.y, z: p.z };
    });

    const rotateWorked = Math.abs(camAfter1F.x - camBefore1F.x) > 0.1 || Math.abs(camAfter1F.z - camBefore1F.z) > 0.1;

    // ==========================================
    // 2. TWO-FINGER ZOOM (PINCH OUT = ZOOM IN)
    // ==========================================
    const camBeforePinch = await page.evaluate(() => {
      const p = window.__fest.stage.camera.position;
      const t = window.__fest.stage.controls.target;
      return { dist: Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z) };
    });

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: midX - 30, y: midY, id: 1 },
        { x: midX + 30, y: midY, id: 2 },
      ],
    });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: midX - 30 - i * 8, y: midY, id: 1 },
          { x: midX + 30 + i * 8, y: midY, id: 2 },
        ],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);

    const camAfterPinch = await page.evaluate(() => {
      const p = window.__fest.stage.camera.position;
      const t = window.__fest.stage.controls.target;
      return { dist: Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z) };
    });

    const pinchWorked = Math.abs(camAfterPinch.dist - camBeforePinch.dist) > 0.2;

    // ==========================================
    // 3. TWO-FINGER PAN
    // ==========================================
    const targetBeforePan = await page.evaluate(() => {
      const t = window.__fest.stage.controls.target;
      return { x: t.x, y: t.y, z: t.z };
    });

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: midX - 20, y: midY, id: 1 },
        { x: midX + 20, y: midY, id: 2 },
      ],
    });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: midX - 20, y: midY + i * 6, id: 1 },
          { x: midX + 20, y: midY + i * 6, id: 2 },
        ],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);

    const targetAfterPan = await page.evaluate(() => {
      const t = window.__fest.stage.controls.target;
      return { x: t.x, y: t.y, z: t.z };
    });

    const panWorked = Math.abs(targetAfterPan.y - targetBeforePan.y) > 0.05 || Math.abs(targetAfterPan.x - targetBeforePan.x) > 0.05;

    // ==========================================
    // 4. SHEET INTERFERENCE WITH GESTURES
    // ==========================================
    // Check if dragging inside open sheet body affects camera
    await page.locator('.mtab[data-tab="rig"]').tap();
    await page.waitForTimeout(300);

    const camBeforeSheetTouch = await page.evaluate(() => {
      const p = window.__fest.stage.camera.position;
      return { x: p.x, y: p.y, z: p.z };
    });

    // Touch inside sheet body and drag
    const sheetBodyBox = await page.evaluate(() => {
      const b = document.querySelector('.sheet-body');
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: sheetBodyBox.x, y: sheetBodyBox.y, id: 1 }],
    });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: sheetBodyBox.x - i * 10, y: sheetBodyBox.y - i * 10, id: 1 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);

    const camAfterSheetTouch = await page.evaluate(() => {
      const p = window.__fest.stage.camera.position;
      return { x: p.x, y: p.y, z: p.z };
    });

    const sheetBlockedCamera = (camAfterSheetTouch.x === camBeforeSheetTouch.x && camAfterSheetTouch.y === camBeforeSheetTouch.y && camAfterSheetTouch.z === camBeforeSheetTouch.z);

    // ==========================================
    // 5. SHEET SWIPE ON HANDLE (OPEN / PEEK)
    // ==========================================
    // Handle position
    const handleBox = await page.evaluate(() => {
      const h = document.querySelector('.sheet .handle');
      const r = h.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });

    // First ensure peek state
    await page.evaluate(() => {
      document.body.dataset.sheet = 'peek';
      document.querySelector('.sheet').dataset.state = 'peek';
    });
    await page.waitForTimeout(200);

    // Swipe UP on handle (dy < -30) -> should open
    // We must use pointer events or dispatch touch events with pointer capture
    const handleSwipeUpResult = await page.evaluate(() => {
      const h = document.querySelector('.sheet .handle');
      const r = h.getBoundingClientRect();
      const sy = r.y + r.height / 2;
      const x = r.x + r.width / 2;

      h.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: sy, pointerId: 1, bubbles: true }));
      h.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: sy - 50, pointerId: 1, bubbles: true }));

      return document.querySelector('.sheet').dataset.state;
    });

    // Swipe DOWN on handle (dy > 30) -> should peek
    const handleSwipeDownResult = await page.evaluate(() => {
      const h = document.querySelector('.sheet .handle');
      const r = h.getBoundingClientRect();
      const sy = r.y + r.height / 2;
      const x = r.x + r.width / 2;

      h.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: sy, pointerId: 1, bubbles: true }));
      h.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: sy + 50, pointerId: 1, bubbles: true }));

      return document.querySelector('.sheet').dataset.state;
    });

    // ==========================================
    // 6. TAB BUTTONS TOGGLE SHEET
    // ==========================================
    // Sheet is in peek. Tap 'rig' -> open
    await page.locator('.mtab[data-tab="rig"]').tap();
    await page.waitForTimeout(200);
    const tabOpenState = await page.evaluate(() => document.querySelector('.sheet').dataset.state);

    // Tap 'rig' again -> peek
    await page.locator('.mtab[data-tab="rig"]').tap();
    await page.waitForTimeout(200);
    const tabTogglePeekState = await page.evaluate(() => document.querySelector('.sheet').dataset.state);

    // Tap 'light' -> open, then tap 'views' -> switch tab and stay open
    await page.locator('.mtab[data-tab="light"]').tap();
    await page.waitForTimeout(200);
    const tabLightState = await page.evaluate(() => document.querySelector('.sheet').dataset.state);

    await page.locator('.mtab[data-tab="views"]').tap();
    await page.waitForTimeout(200);
    const tabViewsState = await page.evaluate(() => ({
      state: document.querySelector('.sheet').dataset.state,
      activeTab: document.querySelector('.mtab.on')?.dataset.tab,
    }));

    results[cfg.name] = {
      rotateWorked,
      pinchWorked,
      panWorked,
      sheetBlockedCamera,
      handleSwipeUpResult,
      handleSwipeDownResult,
      tabOpenState,
      tabTogglePeekState,
      tabLightState,
      tabViewsState,
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testScenario6().catch(console.error);

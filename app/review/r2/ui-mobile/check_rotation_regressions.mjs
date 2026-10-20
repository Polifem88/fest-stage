import { chromium, devices } from '@playwright/test';

async function checkRotationAndRegressions() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const context = await browser.newContext(devices['iPhone 13']);
  const page = await context.newPage();
  const consoleLogs = [];
  page.on('console', m => consoleLogs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => consoleLogs.push({ type: 'pageerror', text: e.message }));

  // ==========================================
  // 1. CHECK INDEX.HTML
  // ==========================================
  await page.goto('http://localhost:5173/index.html');
  await page.waitForTimeout(300);

  const indexData = await page.evaluate(() => {
    const mobileChoice = document.querySelector('a.choice[href*="mobile.html"]');
    const desktopChoice = document.querySelector('a.choice[href*="desktop.html"]');
    const bigIcons = Array.from(document.querySelectorAll('.big-ico')).map(el => {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { text: el.innerText, fontSize: s.fontSize, fontFamily: s.fontFamily, w: r.width, h: r.height };
    });
    return {
      mobileIsRec: mobileChoice?.classList.contains('rec'),
      desktopIsRec: desktopChoice?.classList.contains('rec'),
      bigIcons,
    };
  });

  await page.screenshot({
    path: 'review/r2/ui-mobile/index_iphone.jpg',
    type: 'jpeg',
    quality: 70,
  });

  // ==========================================
  // 2. CHECK MOBILE.HTML ROTATION
  // ==========================================
  await page.goto('http://localhost:5173/mobile.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // Check hint before touching
  const hintBefore = await page.evaluate(() => {
    const h = document.querySelector('.mhint');
    return { visible: h && !h.classList.contains('hide'), text: h?.innerText };
  });

  // Tap on canvas to dismiss hint
  await page.touchscreen.tap(200, 300);
  await page.waitForTimeout(600);

  const hintAfter = await page.evaluate(() => {
    const h = document.querySelector('.mhint');
    return { isHidden: h?.classList.contains('hide') };
  });

  // Take screenshot in portrait
  await page.screenshot({
    path: 'review/r2/ui-mobile/rot_1_portrait.jpg',
    type: 'jpeg',
    quality: 70,
  });

  // Rotate to landscape: 844 x 390
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.__fest.stage.resize());
  await page.waitForTimeout(400);

  // Open sheet in landscape
  await page.locator('.mtab[data-tab="rig"]').tap();
  await page.waitForTimeout(300);

  const landscapeSheetMetrics = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const top = document.querySelector('.mtop');
    const sr = sheet.getBoundingClientRect();
    const tr = top.getBoundingClientRect();
    return {
      sheetTop: sr.top,
      sheetHeight: sr.height,
      sheetWidth: sr.width,
      topBottom: tr.bottom,
      isUnderTop: sr.top >= tr.bottom - 1,
    };
  });

  await page.screenshot({
    path: 'review/r2/ui-mobile/rot_2_landscape_open_sheet.jpg',
    type: 'jpeg',
    quality: 70,
  });

  // Rotate back to portrait: 390 x 844
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__fest.stage.resize());
  await page.waitForTimeout(400);

  const portraitBackMetrics = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const sr = sheet.getBoundingClientRect();
    return {
      sheetWidth: sr.width,
      sheetHeight: sr.height,
      isFullWidth: Math.abs(sr.width - 390) < 5,
    };
  });

  await page.screenshot({
    path: 'review/r2/ui-mobile/rot_3_back_to_portrait.jpg',
    type: 'jpeg',
    quality: 70,
  });

  // ==========================================
  // 3. GESTURES: ROTATION, PINCH ZOOM, PAN
  // ==========================================
  const cdp = await context.newCDPSession(page);

  // Initial camera
  const cam0 = await page.evaluate(() => {
    const c = window.__fest.stage.camera;
    return { pos: [c.position.x, c.position.y, c.position.z], zoom: c.zoom };
  });

  // 1 finger drag (rotate)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 200, y: 300, id: 1 }],
  });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 200 + i * 20, y: 300 + i * 5, id: 1 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);

  const camAfterRotate = await page.evaluate(() => {
    const c = window.__fest.stage.camera;
    return { pos: [c.position.x, c.position.y, c.position.z] };
  });

  const cameraRotated = JSON.stringify(cam0.pos) !== JSON.stringify(camAfterRotate.pos);

  // 2 finger pinch (zoom)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 150, y: 300, id: 1 },
      { x: 250, y: 300, id: 2 },
    ],
  });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 150 - i * 15, y: 300, id: 1 },
        { x: 250 + i * 15, y: 300, id: 2 },
      ],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);

  const camAfterPinch = await page.evaluate(() => {
    const c = window.__fest.stage.camera;
    return { pos: [c.position.x, c.position.y, c.position.z], zoom: c.zoom };
  });

  const cameraZoomed = JSON.stringify(camAfterRotate.pos) !== JSON.stringify(camAfterPinch.pos);

  const report = {
    indexData,
    hintBefore,
    hintAfter,
    landscapeSheetMetrics,
    portraitBackMetrics,
    gestures: {
      cameraRotated,
      cameraZoomed,
      cam0,
      camAfterRotate,
      camAfterPinch,
    },
    consoleLogs,
  };

  await context.close();
  await browser.close();

  console.log(JSON.stringify(report, null, 2));
}

checkRotationAndRegressions().catch(console.error);

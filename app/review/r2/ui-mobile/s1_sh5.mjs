import { chromium, devices } from '@playwright/test';

async function testScenario1() {
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

    // ==========================================
    // 1. VIA BOTTOM SHEET SLIDER / INPUT
    // ==========================================
    const initialH = await page.evaluate(() => window.__fest.height('Sh5'));

    // Open sheet by tapping 'Механика'
    const rigTab = page.locator('.mtab[data-tab="rig"]');
    await rigTab.tap();
    await page.waitForTimeout(300);

    // Scroll Sh5 into view
    await page.evaluate(() => {
      document.querySelector('.rig-row[data-id="Sh5"]')?.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(200);

    // Tap slider of Sh5 around 2.0m (range 1.0 to 6.5, so (2.0-1.0)/(6.5-1.0) = 1.0/5.5)
    const sliderBox = await page.evaluate(() => {
      const row = document.querySelector('.rig-row[data-id="Sh5"]');
      const slider = row.querySelector('input[type="range"]');
      const r = slider.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    await page.touchscreen.tap(sliderBox.x + sliderBox.w * (1.0 / 5.5), sliderBox.y + sliderBox.h / 2);
    await page.waitForTimeout(200);
    const hAfterSlider = await page.evaluate(() => window.__fest.height('Sh5'));

    // ==========================================
    // 2. VIA ±0.1 BUTTONS IN CARD
    // ==========================================
    // Tap Sh5 name button in the row to select it and open card
    await page.locator('.rig-row[data-id="Sh5"] .rig-name').tap();
    await page.waitForTimeout(300);

    // In portrait, opening card might hide card if sheet is open?
    // Let's check card visibility:
    const cardStatusBefore = await page.evaluate(() => {
      const c = document.querySelector('.card');
      const sheet = document.querySelector('.sheet');
      return {
        cardDisplay: c ? window.getComputedStyle(c).display : null,
        sheetState: sheet ? sheet.dataset.state : null,
      };
    });

    // Close or peek sheet so card is visible in portrait
    await page.evaluate(() => {
      window.__fest.select({ kind: 'rig', id: 'Sh5' });
      document.body.dataset.sheet = 'peek';
      const s = document.querySelector('.sheet');
      if (s) s.dataset.state = 'peek';
    });
    await page.waitForTimeout(300);

    const cardBtnsInfo = await page.evaluate(() => {
      const c = document.querySelector('.card');
      if (!c) return null;
      const btns = Array.from(c.querySelectorAll('.card-btns .btn')).map(b => ({
        text: b.innerText.trim(),
        title: b.title,
        w: b.getBoundingClientRect().width,
        h: b.getBoundingClientRect().height,
      }));
      return { valText: c.querySelector('output')?.innerText, btns };
    });

    // Test +0,1 and -0,1 buttons
    const hBeforeStep = await page.evaluate(() => window.__fest.height('Sh5'));
    const plusBtn = page.locator('.card-btns .btn', { hasText: '+0,1' });
    await plusBtn.tap();
    await page.waitForTimeout(200);
    const hAfterPlus = await page.evaluate(() => window.__fest.height('Sh5'));

    const minusBtn = page.locator('.card-btns .btn', { hasText: '−0,1' });
    await minusBtn.tap();
    await page.waitForTimeout(200);
    const hAfterMinus = await page.evaluate(() => window.__fest.height('Sh5'));

    // ==========================================
    // 3. VIA 3D TAP & DRAG (ESPECIALLY LANDSCAPE)
    // ==========================================
    // Reset Sh5 to 6.5
    await page.evaluate(() => {
      window.__fest.setHeight('Sh5', 6.5);
      window.__fest.select(null);
    });
    await page.waitForTimeout(300);

    // Get 3D screen pos of Sh5
    const sh5Pos = await page.evaluate(() => {
      const r = window.__fest.stage.rigging.get('Sh5');
      return window.__fest.project([0, r.h, r.cfg.d]);
    });

    // Tap Sh5 in 3D
    await page.touchscreen.tap(sh5Pos.x, sh5Pos.y);
    await page.waitForTimeout(400);

    const selectedAfterTap = await page.evaluate(() => window.__fest.describe());

    // Check toast location and text
    const toastInfo = await page.evaluate(() => {
      const t = document.querySelector('.toast:not(.hide)');
      const c = document.querySelector('.card');
      if (!t) return null;
      const tr = t.getBoundingClientRect();
      const cr = c ? c.getBoundingClientRect() : null;
      return {
        text: t.innerText,
        toastBox: { x: tr.x, y: tr.y, w: tr.width, h: tr.height },
        cardBox: cr ? { x: cr.x, y: cr.y, w: cr.width, h: cr.height } : null,
        topOffset: tr.top,
      };
    });

    // Now test drag in 3D and check drag-badge
    const cdp = await context.newCDPSession(page);
    const startX = sh5Pos.x;
    const startY = sh5Pos.y;

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, id: 1 }],
    });
    await page.waitForTimeout(50);

    // Check badge status right after start
    let badgeInfo = await page.evaluate(() => {
      const b = document.querySelector('.drag-badge');
      if (!b || b.hidden) return null;
      const r = b.getBoundingClientRect();
      return { text: b.textContent, x: r.x, y: r.y, visible: !b.hidden, isTouch: b.classList.contains('touch') };
    });

    // Drag down 100px
    for (let i = 1; i <= 10; i++) {
      const curY = startY + (100 * i) / 10;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: curY, id: 1 }],
      });
      await page.waitForTimeout(30);
    }

    const badgeDuringDrag = await page.evaluate(() => {
      const b = document.querySelector('.drag-badge');
      if (!b || b.hidden) return null;
      const r = b.getBoundingClientRect();
      return { text: b.textContent, x: r.x, y: r.y, visible: !b.hidden, isTouch: b.classList.contains('touch') };
    });

    await page.screenshot({
      path: `review/r2/ui-mobile/s1_${cfg.name.replace(/\s+/g, '_')}_dragging.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(300);

    const hAfterDrag = await page.evaluate(() => window.__fest.height('Sh5'));

    await page.screenshot({
      path: `review/r2/ui-mobile/s1_${cfg.name.replace(/\s+/g, '_')}_dragged.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    results[cfg.name] = {
      initialH,
      hAfterSlider,
      cardBtnsInfo,
      hBeforeStep,
      hAfterPlus,
      hAfterMinus,
      sh5Pos,
      selectedAfterTap,
      toastInfo,
      badgeInfo,
      badgeDuringDrag,
      hAfterDrag,
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testScenario1().catch(console.error);

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
    // METHOD A: VIA BOTTOM SHEET SLIDER / INPUT
    // ==========================================
    // Initial height of Sh5
    const initialH_A = await page.evaluate(() => window.__fest.height('Sh5'));

    // Step 1: Open sheet by tapping 'Механика'
    let touchesA = 0;
    const rigTab = page.locator('.mtab[data-tab="rig"]');
    await rigTab.tap();
    touchesA++;
    await page.waitForTimeout(300);

    // Step 2: Check if Sh5 is visible in viewport or requires scrolling
    const sh5VisibilityBeforeScroll = await page.evaluate(() => {
      const row = document.querySelector('.rig-row[data-id="Sh5"]');
      const body = document.querySelector('.sheet-body');
      if (!row || !body) return null;
      const rr = row.getBoundingClientRect();
      const br = body.getBoundingClientRect();
      const isVisible = (rr.top >= br.top && rr.bottom <= br.bottom);
      return {
        rowTop: rr.top,
        bodyTop: br.top,
        bodyBottom: br.bottom,
        isVisible,
      };
    });

    // Step 3: Scroll Sh5 into view if not visible
    if (!sh5VisibilityBeforeScroll?.isVisible) {
      await page.evaluate(() => {
        document.querySelector('.rig-row[data-id="Sh5"]')?.scrollIntoView({ block: 'center' });
      });
      // A human user would swipe 1-2 times to scroll the list down
      touchesA += 1;
      await page.waitForTimeout(200);
    }

    await page.screenshot({
      path: `review/ui-mobile/s1_methodA_${cfg.name.replace(/\s+/g, '_')}_list.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    // Step 4: Use slider on Sh5
    // Slider min: 1.0, max: 6.5. Target: 2.0 m.
    // Target ratio = (2.0 - 1.0) / (6.5 - 1.0) = 1.0 / 5.5 ≈ 0.1818
    const sliderBox = await page.evaluate(() => {
      const row = document.querySelector('.rig-row[data-id="Sh5"]');
      const slider = row.querySelector('input[type="range"]');
      const r = slider.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    // Tap on the slider at 18.18% of width
    const targetTapX = sliderBox.x + sliderBox.w * (1.0 / 5.5);
    const targetTapY = sliderBox.y + sliderBox.h / 2;
    await page.touchscreen.tap(targetTapX, targetTapY);
    touchesA++;
    await page.waitForTimeout(200);

    const heightAfterSliderTap = await page.evaluate(() => window.__fest.height('Sh5'));

    // Step 5: Can user adjust precisely to 2.00?
    // Let's try typing "2" into the number input
    const numInput = page.locator('.rig-row[data-id="Sh5"] .num');
    await numInput.tap();
    touchesA++;
    await page.evaluate(() => {
      const inp = document.querySelector('.rig-row[data-id="Sh5"] .num');
      inp.value = '2';
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    });
    touchesA++; // simulated entering "2" and submitting
    await page.waitForTimeout(200);

    const heightAfterInput = await page.evaluate(() => window.__fest.height('Sh5'));

    // ==========================================
    // METHOD B: VIA 3D TAP & DRAG
    // ==========================================
    // Reset to rest
    await page.evaluate(() => {
      window.__fest.setHeight('Sh5', 6.5);
      window.__fest.select(null);
      // Close sheet to peek
      document.body.dataset.sheet = 'peek';
      document.querySelector('.sheet').dataset.state = 'peek';
      window.__fest.stage.resize();
    });
    await page.waitForTimeout(300);

    let touchesB = 0;
    // Find Sh5 in 3D: let's switch to 'hall' or 'overview' to ensure Sh5 is clearly visible
    // In overview view:
    const initialH_B = await page.evaluate(() => window.__fest.height('Sh5'));

    // Let's get the 3D position of Sh5
    const sh5ScreenPos = await page.evaluate(() => {
      // Sh5 depth from RIGGING config
      const r = window.__fest.stage.rigging.get('Sh5');
      const d = r.cfg.d;
      const h = r.h;
      // Project center of batten
      const ptCenter = window.__fest.project([0, h, d]);
      const ptLeft = window.__fest.project([-4, h, d]);
      const ptRight = window.__fest.project([4, h, d]);
      return { ptCenter, ptLeft, ptRight, d, h };
    });

    // Check if the center of Sh5 is covered by any UI element
    const sh5CenterElement = await page.evaluate((pos) => {
      const el = document.elementFromPoint(pos.x, pos.y);
      return el ? { tag: el.tagName, class: el.className } : null;
    }, sh5ScreenPos.ptCenter);

    // Tap on Sh5 center to select
    await page.touchscreen.tap(sh5ScreenPos.ptCenter.x, sh5ScreenPos.ptCenter.y);
    touchesB++;
    await page.waitForTimeout(400);

    const selectionAfterTap = await page.evaluate(() => window.__fest.describe());

    await page.screenshot({
      path: `review/ui-mobile/s1_methodB_${cfg.name.replace(/\s+/g, '_')}_selected.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    // Now Sh5 should be selected. Now perform drag gesture!
    // We touch at the batten position and drag down
    const cdp = await context.newCDPSession(page);
    const startX = sh5ScreenPos.ptCenter.x;
    const startY = sh5ScreenPos.ptCenter.y;

    // Dispatch touchStart
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, id: 1 }],
    });

    // Drag down in several steps
    const steps = 15;
    // How many pixels down corresponds to dropping 4.5 meters?
    // Let's drag down by 150 pixels
    for (let i = 1; i <= steps; i++) {
      const currentY = startY + (150 * i) / steps;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: currentY, id: 1 }],
      });
      await page.waitForTimeout(20);
    }

    // Dispatch touchEnd
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    touchesB++; // 1 touch gesture for dragging
    await page.waitForTimeout(400);

    const heightAfter3DDrag = await page.evaluate(() => window.__fest.height('Sh5'));

    // Check card preset button 2.0 or slider in card
    // The card has preset buttons or slider
    const cardInfo = await page.evaluate(() => {
      const card = document.querySelector('.card');
      const val = card ? card.querySelector('.big')?.innerText : null;
      return { cardVisible: card && !card.hidden, val };
    });

    await page.screenshot({
      path: `review/ui-mobile/s1_methodB_${cfg.name.replace(/\s+/g, '_')}_dragged.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    results[cfg.name] = {
      methodA: {
        initialH: initialH_A,
        sh5VisibilityBeforeScroll,
        heightAfterSliderTap,
        heightAfterInput,
        touches: touchesA,
      },
      methodB: {
        initialH: initialH_B,
        sh5ScreenPos,
        sh5CenterElement,
        selectionAfterTap,
        heightAfter3DDrag,
        cardInfo,
        touches: touchesB,
      },
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testScenario1().catch(console.error);

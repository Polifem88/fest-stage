import { chromium, devices } from '@playwright/test';

async function testScenario3() {
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

    const f53Details = await page.evaluate(() => {
      const f = window.__fest.stage.fixtures.byNo.get('53');
      return f ? { idx: f.idx, no: f.no, group: f.group, type: f.type, on: f.on } : null;
    });

    // ==========================================
    // TEST A: TAP FIXTURE 53 IN 3D
    // ==========================================
    // Switch to view 'hall' or 'overview' where C2 fixtures are clearly visible
    await page.evaluate(() => {
      window.__fest.setView('hall');
      window.__fest.stage.render();
    });
    await page.waitForTimeout(300);

    const f53Screen = await page.evaluate(() => {
      const f = window.__fest.stage.fixtures.byNo.get('53');
      if (!f || !f.world) return null;
      return window.__fest.project([f.world.head.x, f.world.head.y, -f.world.head.z]);
    });

    // Tap on fixture in 3D
    let selAfter3DTap = null;
    if (f53Screen) {
      await page.touchscreen.tap(f53Screen.x, f53Screen.y);
      await page.waitForTimeout(300);
      selAfter3DTap = await page.evaluate(() => window.__fest.describe());
    }

    // ==========================================
    // TEST B: SEARCH FIXTURE 53
    // ==========================================
    // Open Light tab
    const lightTab = page.locator('.mtab[data-tab="light"]');
    await lightTab.tap();
    await page.waitForTimeout(300);

    // Check search input position and scrollIntoView on focus
    const searchInput = page.locator('.panel-light .search');
    await searchInput.tap();
    await page.waitForTimeout(400);

    const searchInputMetrics = await page.evaluate(() => {
      const inp = document.querySelector('.panel-light .search');
      const btn = document.querySelector('.panel-light .search-row .btn');
      const rInp = inp.getBoundingClientRect();
      const rBtn = btn.getBoundingClientRect();
      return {
        inp: { w: rInp.width, h: rInp.height, y: rInp.y },
        btn: { w: rBtn.width, h: rBtn.height, y: rBtn.y },
      };
    });

    await searchInput.fill('53');
    await page.locator('.panel-light .search-row .btn').tap();
    await page.waitForTimeout(300);

    const selAfterSearch = await page.evaluate(() => window.__fest.describe());

    // Card should be open. In landscape, check card height and scrollability (did it cut properties?)
    const cardInfo = await page.evaluate(() => {
      const card = document.querySelector('.card');
      if (!card) return null;
      const r = card.getBoundingClientRect();
      const rows = Array.from(card.querySelectorAll('dl dt, dl dd')).map(el => el.innerText);
      const toggleBtn = card.querySelector('.tgl');
      const closeBtn = card.querySelector('.x');
      const rClose = closeBtn ? closeBtn.getBoundingClientRect() : null;
      return {
        cardBox: { x: r.x, y: r.y, w: r.width, h: r.height },
        scrollHeight: card.scrollHeight,
        clientHeight: card.clientHeight,
        hasScroll: card.scrollHeight > card.clientHeight,
        rowsCount: rows.length,
        closeBtnSize: rClose ? { w: rClose.width, h: rClose.height } : null,
        toggleState: toggleBtn ? toggleBtn.getAttribute('aria-checked') : null,
      };
    });

    await page.screenshot({
      path: `review/r2/ui-mobile/s3_search53_${cfg.name.replace(/\s+/g, '_')}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    // Close card
    await page.locator('.card .x').tap();
    await page.waitForTimeout(200);

    // ==========================================
    // TEST C: TAP CHIP IN PANEL (SHEET DOES NOT COLLAPSE)
    // ==========================================
    // Reopen light tab
    await lightTab.tap();
    await page.waitForTimeout(300);

    // Find chip 53
    // Group C2 details should be open or we ensure it's open
    await page.evaluate(() => {
      const summary = Array.from(document.querySelectorAll('details.grp summary')).find(s => s.innerText.includes('Софит 2'));
      if (summary && !summary.parentElement.open) summary.click();
    });
    await page.waitForTimeout(200);

    const chip53 = page.locator('.chip', { hasText: '53' });
    const chipMetrics = await page.evaluate(() => {
      const c = Array.from(document.querySelectorAll('.chip')).find(el => el.innerText.trim() === '53');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });

    // Check sheet state before tap
    const sheetStateBeforeTap = await page.evaluate(() => document.querySelector('.sheet').dataset.state);

    // Tap chip 53
    await chip53.tap();
    await page.waitForTimeout(300);

    const sheetStateAfterTap = await page.evaluate(() => document.querySelector('.sheet').dataset.state);
    const selAfterChipTap = await page.evaluate(() => window.__fest.describe());

    // ==========================================
    // TEST D: LONG PRESS CHIP 53 TO TOGGLE ON/OFF
    // ==========================================
    const stateBeforeLongPress = await page.evaluate(() => {
      const f = window.__fest.stage.fixtures.byNo.get('53');
      return f.on;
    });

    const chipBox = await chip53.boundingBox();
    const cdp = await context.newCDPSession(page);

    // TouchStart
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: chipBox.x + chipBox.width / 2, y: chipBox.y + chipBox.height / 2, id: 1 }],
    });

    // Wait 700 ms for long press timer (common.js uses 500 ms)
    await page.waitForTimeout(700);

    // TouchEnd
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(300);

    const stateAfterLongPress = await page.evaluate(() => {
      const f = window.__fest.stage.fixtures.byNo.get('53');
      const t = document.querySelector('.toast:not(.hide)');
      return { on: f.on, toast: t ? t.innerText : null };
    });

    // Another long press to toggle back
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: chipBox.x + chipBox.width / 2, y: chipBox.y + chipBox.height / 2, id: 2 }],
    });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(300);

    const stateAfterSecondLongPress = await page.evaluate(() => {
      const f = window.__fest.stage.fixtures.byNo.get('53');
      const t = document.querySelector('.toast:not(.hide)');
      return { on: f.on, toast: t ? t.innerText : null };
    });

    await page.screenshot({
      path: `review/r2/ui-mobile/s3_longpress53_${cfg.name.replace(/\s+/g, '_')}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    results[cfg.name] = {
      f53Details,
      selAfter3DTap,
      searchInputMetrics,
      selAfterSearch,
      cardInfo,
      chipMetrics,
      sheetStateBeforeTap,
      sheetStateAfterTap,
      sheetRetainedOpen: sheetStateAfterTap === 'open',
      selAfterChipTap,
      stateBeforeLongPress,
      stateAfterLongPress,
      stateAfterSecondLongPress,
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testScenario3().catch(console.error);

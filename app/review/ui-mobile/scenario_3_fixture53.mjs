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

    let touchesSearch = 0;

    // Open sheet tab 'Свет'
    await page.locator('.mtab[data-tab="light"]').tap();
    touchesSearch++;
    await page.waitForTimeout(300);

    // Test Search Path
    const searchInput = page.locator('.panel-light .search');
    await searchInput.tap();
    touchesSearch++;
    await searchInput.fill('53');
    touchesSearch++; // typing

    const findBtn = page.locator('.panel-light .search-row .btn');
    await findBtn.tap();
    touchesSearch++;
    await page.waitForTimeout(400);

    // Verify card is opened and sheet collapsed to peek
    const cardStateAfterFind = await page.evaluate(() => {
      const card = document.querySelector('.card');
      const sheet = document.querySelector('.sheet');
      const d = window.__fest.describe();
      const cr = card ? card.getBoundingClientRect() : null;
      return {
        cardVisible: card && !card.hidden,
        cardRect: cr ? { x: cr.x, y: cr.y, w: cr.width, h: cr.height } : null,
        sheetState: sheet ? sheet.dataset.state : null,
        described: d,
      };
    });

    await page.screenshot({
      path: `review/ui-mobile/s3_find53_${cfg.name.replace(/\s+/g, '_')}_card.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    // Check fixture 53 state before toggle
    const fix53Before = await page.evaluate(() => {
      const f = window.__fest.stage.fixtures.byNo.get('53');
      return { no: f.no, on: f.on, idx: f.idx };
    });

    // Tap toggle in card to switch off
    const cardToggle = page.locator('.card .tgl');
    await cardToggle.tap();
    touchesSearch++;
    await page.waitForTimeout(300);

    // Check fixture 53 state after toggle
    const fix53After = await page.evaluate(() => {
      const f = window.__fest.stage.fixtures.byNo.get('53');
      return { no: f.no, on: f.on, idx: f.idx };
    });

    await page.screenshot({
      path: `review/ui-mobile/s3_find53_${cfg.name.replace(/\s+/g, '_')}_toggled.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    // Now test closing card via 'x'
    const closeBtn = page.locator('.card .x');
    await closeBtn.tap();
    touchesSearch++;
    await page.waitForTimeout(300);

    const cardClosed = await page.evaluate(() => {
      const card = document.querySelector('.card');
      return { hidden: card ? card.hidden : true, selected: window.__fest.describe() };
    });

    // ==========================================
    // TEST CHIP NAVIGATION PATH
    // ==========================================
    let touchesChip = 0;
    // Re-open sheet tab 'Свет'
    await page.locator('.mtab[data-tab="light"]').tap();
    touchesChip++;
    await page.waitForTimeout(300);

    // Expand details 'Софит 2'
    const detailsC2 = await page.evaluate(() => {
      const grps = Array.from(document.querySelectorAll('.panel-light details.grp'));
      for (const g of grps) {
        if (g.innerText.includes('Софит 2')) {
          g.open = true; // or click summary
          return true;
        }
      }
      return false;
    });
    touchesChip++; // tapping details summary
    await page.waitForTimeout(200);

    // Find chip '53'
    const chipInfo = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.panel-light details.grp .chip'));
      const chip53 = chips.find(c => c.innerText.trim() === '53');
      if (!chip53) return null;
      const r = chip53.getBoundingClientRect();
      return { text: chip53.innerText.trim(), x: r.x, y: r.y, w: r.width, h: r.height };
    });

    // Tap chip 53
    if (chipInfo) {
      await page.touchscreen.tap(chipInfo.x + chipInfo.w / 2, chipInfo.y + chipInfo.h / 2);
      touchesChip++;
      await page.waitForTimeout(300);
    }

    const afterChipTap = await page.evaluate(() => {
      const card = document.querySelector('.card');
      const sheet = document.querySelector('.sheet');
      const d = window.__fest.describe();
      return {
        cardVisible: card && !card.hidden,
        sheetState: sheet ? sheet.dataset.state : null,
        selectedId: d ? d.title : null,
      };
    });

    results[cfg.name] = {
      searchPath: {
        touches: touchesSearch,
        cardStateAfterFind,
        fix53Before,
        fix53After,
        cardClosed,
      },
      chipPath: {
        touches: touchesChip,
        chipInfo,
        afterChipTap,
      },
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testScenario3().catch(console.error);

import { chromium, devices } from '@playwright/test';

async function testScenario4and5() {
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
    // SCENARIO 4: PLAN + BLUEPRINT + SCREENSHOT/SHARE UI
    // ==========================================
    let touchesPlan = 0;

    // 1. Open sheet -> 'Виды'
    await page.locator('.mtab[data-tab="views"]').tap();
    touchesPlan++;
    await page.waitForTimeout(300);

    // 2. Tap 'План сверху' button
    const planBtn = page.locator('.panel-views .btn.view:has-text("План сверху")');
    await planBtn.tap();
    touchesPlan++;
    await page.waitForTimeout(300);

    // Check if sheet closed to 'peek'
    const sheetStateAfterPlan = await page.evaluate(() => document.querySelector('.sheet').dataset.state);

    // 3. Turn on 'Чертёж' via header quick button
    const bpBtn = page.locator('.mtop .quick .tgl[data-id="q-bp"]');
    await bpBtn.tap();
    touchesPlan++;
    await page.waitForTimeout(300);

    const bpActive = await page.evaluate(() => window.__fest.stage.flags.blueprint);

    // 4. Check what tools are listed under 'Сохранить / поделиться' in views panel
    // Re-open views tab
    await page.locator('.mtab[data-tab="views"]').tap();
    await page.waitForTimeout(300);

    const sharingTools = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.panel-views .grid-1 .btn')).map(b => b.innerText.trim());
      return btns;
    });

    // Close sheet to peek
    await page.locator('.sheet .handle').tap();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: `review/ui-mobile/s4_plan_bp_${cfg.name.replace(/\s+/g, '_')}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    // ==========================================
    // SCENARIO 5: SHARE URL & RESTORE STATE
    // ==========================================
    // Set custom state:
    // Sh5 = 2.0 m, only C2 on, blueprint on, plan view
    await page.evaluate(() => {
      const f = window.__fest;
      f.setHeight('Sh5', 2.0);
      f.light('all', false);
      f.light('C2', true);
      f.flag('blueprint', true);
      f.setView('plan');
      f.renderNow();
    });
    await page.waitForTimeout(300);

    const expectedStateBeforeShare = await page.evaluate(() => {
      const f = window.__fest;
      return {
        view: f.stage.view,
        sh5Height: f.height('Sh5'),
        c2On: f.stage.fixtures.list.filter(x => x.group === 'C2' && x.on).length,
        othersOn: f.stage.fixtures.list.filter(x => x.group !== 'C2' && x.on).length,
        blueprint: f.stage.flags.blueprint,
        duty: f.stage.flags.duty,
      };
    });

    // Generate share URL
    const shareUrl = await page.evaluate(() => window.__fest.stage.shareUrl());

    // Open a brand new page with the share URL
    const restorePage = await context.newPage();
    const restoreConsole = [];
    restorePage.on('console', m => restoreConsole.push({ type: m.type(), text: m.text() }));
    restorePage.on('pageerror', e => restoreConsole.push({ type: 'pageerror', text: e.message }));

    await restorePage.goto(shareUrl);
    await restorePage.waitForFunction(() => window.__fest?.ready);
    await restorePage.waitForTimeout(500);

    const restoredState = await restorePage.evaluate(() => {
      const f = window.__fest;
      return {
        view: f.stage.view,
        sh5Height: f.height('Sh5'),
        c2On: f.stage.fixtures.list.filter(x => x.group === 'C2' && x.on).length,
        othersOn: f.stage.fixtures.list.filter(x => x.group !== 'C2' && x.on).length,
        blueprint: f.stage.flags.blueprint,
        duty: f.stage.flags.duty,
      };
    });

    await restorePage.screenshot({
      path: `review/ui-mobile/s5_restored_${cfg.name.replace(/\s+/g, '_')}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    await restorePage.close();

    results[cfg.name] = {
      scenario4: {
        touches: touchesPlan,
        sheetStateAfterPlan,
        bpActive,
        sharingTools,
      },
      scenario5: {
        shareUrl,
        expectedStateBeforeShare,
        restoredState,
        isIdentical: JSON.stringify(expectedStateBeforeShare) === JSON.stringify(restoredState),
      },
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testScenario4and5().catch(console.error);

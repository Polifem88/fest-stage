import { chromium, devices } from '@playwright/test';

async function testScenario2() {
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

    // Initial light state
    const initialStats = await page.evaluate(() => {
      const list = window.__fest.stage.fixtures.list;
      const onFixtures = list.filter(f => f.on).map(f => ({ no: f.no, group: f.group }));
      return { total: list.length, onCount: onFixtures.length, stageState: window.__fest.stage.stageState() };
    });

    // Step 1: Open sheet by tapping 'Свет'
    let touches = 0;
    const lightTab = page.locator('.mtab[data-tab="light"]');
    await lightTab.tap();
    touches++;
    await page.waitForTimeout(300);

    // Step 2: Locate the solo button for C2
    // Look for button with data-id="solo-C2" or aria-label containing "Соло: только С2"
    const soloBtn = page.locator('.solo[data-id="solo-C2"]');
    const soloBtnBox = await soloBtn.boundingBox();

    // Check size of solo button (target >= 44x44)
    const soloMetrics = await page.evaluate(() => {
      const b = document.querySelector('.solo[data-id="solo-C2"]');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      return {
        w: r.width,
        h: r.height,
        minWidth: style.minWidth,
        minHeight: style.minHeight,
        fontSize: style.fontSize,
      };
    });

    // Step 3: Tap 'соло' on C2
    await soloBtn.tap();
    touches++;
    await page.waitForTimeout(300);

    // Check light state immediately after tapping solo
    const afterSoloStats = await page.evaluate(() => {
      const list = window.__fest.stage.fixtures.list;
      const onFixtures = list.filter(f => f.on);
      const groupsOn = [...new Set(onFixtures.map(f => f.group))];
      const c2Fixtures = onFixtures.filter(f => f.group === 'C2');
      const nonC2On = onFixtures.filter(f => f.group !== 'C2');
      return {
        totalOn: onFixtures.length,
        groupsOn,
        c2Count: c2Fixtures.length,
        c2Total: list.filter(f => f.group === 'C2').length,
        nonC2OnCount: nonC2On.length,
        stageState: window.__fest.stage.stageState(),
        groupSetC2: window.__fest.stage.groupSetState('C2'),
      };
    });

    // Check toast
    const toastText = await page.evaluate(() => {
      const t = document.querySelector('.toast:not(.hide)');
      return t ? t.innerText : null;
    });

    // Step 4: Close sheet (tap peek or handle) to see the 3D scene with only C2 illuminated
    await page.evaluate(() => {
      document.body.dataset.sheet = 'peek';
      const s = document.querySelector('.sheet');
      if (s) s.dataset.state = 'peek';
      window.__fest.stage.resize();
    });
    touches++;
    await page.waitForTimeout(300);

    await page.screenshot({
      path: `review/r2/ui-mobile/s2_soloC2_${cfg.name.replace(/\s+/g, '_')}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    results[cfg.name] = {
      initialStats,
      soloMetrics,
      afterSoloStats,
      toastText,
      touches,
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testScenario2().catch(console.error);

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

    let touches = 0;

    // Step 1: Open sheet tab 'Свет'
    const lightTab = page.locator('.mtab[data-tab="light"]');
    await lightTab.tap();
    touches++;
    await page.waitForTimeout(300);

    // Initial state before action
    const initialState = await page.evaluate(() => {
      const f = window.__fest;
      const allStageOn = f.stage.stageState();
      const duty = f.stage.flags.duty;
      const c2State = f.stage.groupSetState('C2');
      return { allStageOn, duty, c2State };
    });

    // Step 2: User turns off master "Сценический свет"
    // Find toggle for stage light
    const stageToggle = page.locator('.panel-light .tgl[data-id="stage"]');
    await stageToggle.tap();
    touches++;
    await page.waitForTimeout(200);

    // Step 3: User turns ON "С2 · 11"
    const c2Toggle = page.locator('.panel-light .tgl[data-id="g-C2"]');
    await c2Toggle.tap();
    touches++;
    await page.waitForTimeout(200);

    // Step 4: Turn off duty light if "only C2" means no working lights
    const dutyToggle = page.locator('.panel-light .tgl[data-id="duty"]');
    await dutyToggle.tap();
    touches++;
    await page.waitForTimeout(200);

    // Verify lighting state
    const finalState = await page.evaluate(() => {
      const f = window.__fest;
      const list = f.stage.fixtures.list;
      const onFixtures = list.filter(fix => fix.on).map(fix => ({ no: fix.no, group: fix.group, type: fix.type }));
      const c2Total = list.filter(fix => fix.group === 'C2').length;
      const c2On = list.filter(fix => fix.group === 'C2' && fix.on).length;
      const othersOn = list.filter(fix => fix.group !== 'C2' && fix.on).length;
      return {
        duty: f.stage.flags.duty,
        house: f.stage.flags.house,
        c2Total,
        c2On,
        othersOn,
        onCount: onFixtures.length,
        onFixturesSample: onFixtures.slice(0, 5),
      };
    });

    // Close sheet to observe 3D scene with only C2
    await page.locator('.sheet .handle').tap();
    touches++;
    await page.waitForTimeout(400);

    await page.screenshot({
      path: `review/ui-mobile/s2_onlyC2_${cfg.name.replace(/\s+/g, '_')}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    results[cfg.name] = {
      initialState,
      finalState,
      touches,
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testScenario2().catch(console.error);

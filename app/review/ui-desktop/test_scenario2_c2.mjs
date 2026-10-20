import { chromium } from '@playwright/test';

const outDir = 'review/ui-desktop';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('--- Scenario 2: Turn on only C2, turn everything else off ---');
  // Initial state:
  const initStage = await page.evaluate(() => window.__fest.stage.stageState());
  const initDuty = await page.evaluate(() => window.__fest.stage.flags.duty);
  const initHouse = await page.evaluate(() => window.__fest.stage.flags.house);
  console.log(`Initial: stage=${initStage}, duty=${initDuty}, house=${initHouse}`);

  // Step 1: Open '💡 Свет' tab
  const lightTabBtn = page.locator('button.tab[data-tab="light"]');
  await lightTabBtn.click();
  await page.waitForTimeout(100);

  // Check if panel-light is visible
  const isLightPanelVisible = await page.isVisible('.panel-light');
  console.log('Step 1: Light panel visible:', isLightPanelVisible);

  // Step 2: Turn off all stage lights via 'Сценический свет' master toggle
  const stageMasterBtn = page.locator('.panel-light button.tgl[data-id="stage"]');
  console.log('Stage master aria-checked before click:', await stageMasterBtn.getAttribute('aria-checked'));
  await stageMasterBtn.click();
  await page.waitForTimeout(150);
  console.log('Stage master aria-checked after click:', await stageMasterBtn.getAttribute('aria-checked'));
  console.log('Stage state after master off:', await page.evaluate(() => window.__fest.stage.stageState()));

  // Step 3: Turn on C2 via 'С2 · 11' button
  const c2Btn = page.locator('.panel-light button.tgl[data-id="g-C2"]');
  console.log('C2 button text:', await c2Btn.textContent());
  console.log('C2 button aria-checked before click:', await c2Btn.getAttribute('aria-checked'));
  await c2Btn.click();
  await page.waitForTimeout(150);
  console.log('C2 button aria-checked after click:', await c2Btn.getAttribute('aria-checked'));
  console.log('Stage master button aria-checked after C2 turned on:', await stageMasterBtn.getAttribute('aria-checked'));

  // Step 4: Turn off duty light (дежурка) if needed
  const dutyBtn = page.locator('.panel-light button.tgl[data-id="duty"]');
  if (await page.evaluate(() => window.__fest.stage.flags.duty)) {
    console.log('Turning off duty light...');
    await dutyBtn.click();
    await page.waitForTimeout(150);
  }

  // Verify which fixtures are ON
  const onSummary = await page.evaluate(() => {
    const st = window.__fest.stage;
    const onFixtures = st.fixtures.list.filter(f => f.on);
    const groups = {};
    for (const f of onFixtures) {
      groups[f.group] = (groups[f.group] || 0) + 1;
    }
    return {
      totalOn: onFixtures.length,
      groups,
      stageState: st.stageState(),
      c2State: st.groupSetState('C2'),
      c0State: st.groupSetState('C0'),
      c1State: st.groupSetState('C1'),
      c3State: st.groupSetState('C3'),
      flags: st.flags
    };
  });
  console.log('Resulting light state:', onSummary);

  // Take screenshot in Overview
  await page.screenshot({ path: `${outDir}/05_only_c2_overview.jpg`, quality: 70, type: 'jpeg' });

  // Switch to Hall view instant to avoid animation wait
  await page.evaluate(() => window.__fest.setView('hall'));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/06_only_c2_hall.jpg`, quality: 70, type: 'jpeg' });

  // Check topbar quickbar synchronization:
  const qStageState = await page.locator('button.tgl[data-id="q-stage"]').getAttribute('aria-checked');
  const qDutyState = await page.locator('button.tgl[data-id="q-duty"]').getAttribute('aria-checked');
  console.log(`Topbar quickbar: q-stage=${qStageState}, q-duty=${qDutyState}`);

  console.log('Console logs count:', logs.length);
  if (logs.length > 0) console.log('Logs:', logs);

  await browser.close();
  console.log('Test 2 finished successfully.');
}

run().catch(e => {
  console.error('Test 2 failed:', e);
  process.exit(1);
});

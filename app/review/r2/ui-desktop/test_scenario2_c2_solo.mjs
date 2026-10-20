import { chromium } from '@playwright/test';

const OUT_DIR = 'review/r2/ui-desktop';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('=== TEST SCENARIO 2: C2 SOLO ===');

  // Go to Light tab
  await page.click('button[data-tab="light"]');
  await page.waitForTimeout(100);

  // Locate the solo button for C2
  const soloBtn = page.locator('button.solo[data-id="solo-C2"]');
  console.log('Solo C2 button exists:', await soloBtn.count());
  const soloTitle = await soloBtn.getAttribute('title');
  console.log('Solo button title:', soloTitle);

  // Click Solo C2
  await soloBtn.click();
  await page.waitForTimeout(150);

  // Check state of all group sets
  const states = await page.evaluate(() => {
    const f = window.__fest.stage;
    const sets = ['C0', 'C1', 'C2', 'C3', 'galleries', 'bridges', 'boxes', 'towers', 'foh'];
    const res = {};
    for (const s of sets) {
      res[s] = f.groupSetState(s);
    }
    res.stageState = f.stageState();
    res.c2OnCount = f.fixtures.list.filter(fx => fx.group === 'C2' && fx.on).length;
    res.c2Total = f.fixtures.list.filter(fx => fx.group === 'C2').length;
    res.otherOnCount = f.fixtures.list.filter(fx => fx.group !== 'C2' && fx.on).length;
    return res;
  });
  console.log('Group states after Solo C2:', states);

  // Turn off duty light via quick bar button
  const dutyToggle = page.locator('.quick .tgl[data-id="q-duty"]');
  await dutyToggle.click();
  await page.waitForTimeout(100);

  const dutyState = await page.evaluate(() => window.__fest.stage.flags.duty);
  console.log('Duty light flag:', dutyState);

  // Toast check
  const toastText = await page.evaluate(() => document.querySelector('.toast')?.textContent);
  console.log('Toast after solo click:', toastText);

  // Take screenshot in Overview
  await page.screenshot({ path: `${OUT_DIR}/06_only_c2_overview.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // Switch to Hall view
  await page.click('button[data-tab="views"]');
  await page.click('button.view:has-text("Из зала")');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT_DIR}/07_only_c2_hall.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  await browser.close();
  console.log('=== TEST SCENARIO 2 FINISHED ===');
}

run().catch(console.error);

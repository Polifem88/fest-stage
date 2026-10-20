import { chromium } from '@playwright/test';

const outDir = 'review/ui-desktop';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1920, height: 1080 }
  });

  const page1 = await context.newPage();
  const logs = [];
  page1.on('console', m => logs.push(`[page1][${m.type()}] ${m.text()}`));
  page1.on('pageerror', e => logs.push(`[page1][pageerror] ${e.message}`));

  await page1.goto('http://localhost:5173/desktop.html');
  await page1.waitForFunction(() => window.__fest?.ready);

  console.log('--- Scenario 5: Share link and restore state in new tab ---');

  // Set up a custom non-default state
  // 1. Rigging heights: Sh5 = 2.0, C2 = 3.5, Sh9 = 1.8
  await page1.evaluate(() => {
    window.__fest.setHeight('Sh5', 2.0);
    window.__fest.setHeight('C2', 3.5);
    window.__fest.setHeight('Sh9', 1.8);
  });

  // 2. Lights: Turn off all stage, turn on C2, turn off duty, turn on house
  await page1.click('button.tab[data-tab="light"]');
  await page1.waitForTimeout(100);
  // Turn off all stage
  await page1.click('.panel-light button.tgl[data-id="stage"]');
  await page1.waitForTimeout(100);
  // Turn on C2
  await page1.click('.panel-light button.tgl[data-id="g-C2"]');
  await page1.waitForTimeout(100);
  // Turn off duty
  await page1.click('.panel-light button.tgl[data-id="duty"]');
  await page1.waitForTimeout(100);
  // Turn on house
  await page1.click('.panel-light button.tgl[data-id="house"]');
  await page1.waitForTimeout(100);

  // 3. Flags: turn on grid, turn on dims
  await page1.click('button.tab[data-tab="layers"]');
  await page1.waitForTimeout(100);
  await page1.click('.panel-layers button.tgl:has-text("Размеры")');
  await page1.waitForTimeout(100);
  await page1.click('.panel-layers button.tgl:has-text("Сетка")');
  await page1.waitForTimeout(100);

  // 4. Layers: hide galleries
  await page1.click('.panel-layers button.tgl[data-id="l-galleries"]');
  await page1.waitForTimeout(100);

  // 5. View: 'hall'
  await page1.click('button.tab[data-tab="views"]');
  await page1.waitForTimeout(100);
  await page1.click('.panel-views button.view:has-text("Из зала")');
  await page1.waitForTimeout(300);

  // Capture source state
  const sourceState = await page1.evaluate(() => window.__fest.getState());
  console.log('Source state summary:', {
    sh5: sourceState.heights.Sh5,
    c2: sourceState.heights.C2,
    sh9: sourceState.heights.Sh9,
    flags: sourceState.flags,
    layers: sourceState.layers,
    view: sourceState.view
  });

  // Take screenshot of page1
  await page1.screenshot({ path: `${outDir}/10_share_source_page.jpg`, quality: 70, type: 'jpeg' });

  // Click '🔗 Ссылка' button in topbar
  const shareBtn = page1.locator('.top-actions button:has-text("🔗 Ссылка")');
  await shareBtn.click();
  await page1.waitForTimeout(200);

  // Check toast
  const toastText = await page1.locator('.toast').innerText().catch(() => null);
  console.log('Toast after clicking share:', toastText);

  // Get share URL from page or clipboard
  const shareUrl = await page1.evaluate(() => window.__fest.stage.shareUrl());
  console.log('Generated share URL:', shareUrl);

  // Now open in a second tab (page2)
  console.log('Opening share URL in page 2...');
  const page2 = await context.newPage();
  page2.on('console', m => logs.push(`[page2][${m.type()}] ${m.text()}`));
  page2.on('pageerror', e => logs.push(`[page2][pageerror] ${e.message}`));

  await page2.goto(shareUrl);
  await page2.waitForFunction(() => window.__fest?.ready);
  await page2.waitForTimeout(500);

  // Check restored state in page 2
  const restoredState = await page2.evaluate(() => window.__fest.getState());
  console.log('Restored state in page 2:', {
    sh5: restoredState.heights.Sh5,
    c2: restoredState.heights.C2,
    sh9: restoredState.heights.Sh9,
    flags: restoredState.flags,
    layers: restoredState.layers,
    view: restoredState.view
  });

  // Compare states
  const diffs = [];
  if (Math.abs(restoredState.heights.Sh5 - sourceState.heights.Sh5) > 0.01) diffs.push(`Sh5 mismatch: ${sourceState.heights.Sh5} vs ${restoredState.heights.Sh5}`);
  if (Math.abs(restoredState.heights.C2 - sourceState.heights.C2) > 0.01) diffs.push(`C2 mismatch: ${sourceState.heights.C2} vs ${restoredState.heights.C2}`);
  if (Math.abs(restoredState.heights.Sh9 - sourceState.heights.Sh9) > 0.01) diffs.push(`Sh9 mismatch: ${sourceState.heights.Sh9} vs ${restoredState.heights.Sh9}`);
  if (restoredState.view !== sourceState.view) diffs.push(`View mismatch: ${sourceState.view} vs ${restoredState.view}`);
  for (const k of Object.keys(sourceState.flags)) {
    if (restoredState.flags[k] !== sourceState.flags[k]) diffs.push(`Flag ${k} mismatch: ${sourceState.flags[k]} vs ${restoredState.flags[k]}`);
  }
  for (const k of Object.keys(sourceState.layers)) {
    if (restoredState.layers[k] !== sourceState.layers[k]) diffs.push(`Layer ${k} mismatch: ${sourceState.layers[k]} vs ${restoredState.layers[k]}`);
  }
  console.log('State differences (should be empty):', diffs);

  // Check UI synchronization on page 2:
  // Is "Из зала" button marked as .on in views?
  await page2.click('button.tab[data-tab="views"]');
  await page2.waitForTimeout(100);
  const hallBtnClass = await page2.locator('.panel-views button.view:has-text("Из зала")').getAttribute('class');
  console.log('Page 2 hall view button class (should include "on"):', hallBtnClass);

  // Take screenshot of page 2
  await page2.screenshot({ path: `${outDir}/11_share_restored_page.jpg`, quality: 70, type: 'jpeg' });

  console.log('Console logs count:', logs.length);
  if (logs.length > 0) console.log('Logs:', logs);

  await browser.close();
  console.log('Test 5 finished successfully.');
}

run().catch(e => {
  console.error('Test 5 failed:', e);
  process.exit(1);
});

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

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

  console.log('=== Additional Tests ===');

  // --- 1. Tape measure (Рулетка) ---
  console.log('--- 1. Testing Tape Measure ---');
  // Switch to Layers tab
  await page.click('button.tab[data-tab="layers"]');
  await page.waitForTimeout(100);
  const measureBtn = page.locator('.panel-layers button.tgl[data-id="measure"]');
  await measureBtn.click();
  await page.waitForTimeout(200);

  console.log('Measure active:', await page.evaluate(() => window.__fest.stage.measure.active));
  console.log('Cursor style in measure mode:', await page.evaluate(() => window.__fest.stage.renderer.domElement.style.cursor));

  // Switch to plan view to clearly measure portal width (-6.25 to +6.25 at portal d=0)
  await page.evaluate(() => window.__fest.setView('plan'));
  await page.waitForTimeout(300);

  // Portal left edge is at x = -6.25, y = 0, d = 0
  // Portal right edge is at x = +6.25, y = 0, d = 0
  // In plan view, let's project these two points
  const pLeft = await page.evaluate(() => window.__fest.project([-6.25, 0, 0]));
  const pRight = await page.evaluate(() => window.__fest.project([6.25, 0, 0]));
  console.log('Projected portal points:', { pLeft, pRight });

  // Click left point, then right point
  await page.mouse.click(pLeft.x, pLeft.y);
  await page.waitForTimeout(200);
  let ptsCount = await page.evaluate(() => window.__fest.stage.measure.points.length);
  console.log('Points after 1st click:', ptsCount);

  await page.mouse.click(pRight.x, pRight.y);
  await page.waitForTimeout(200);
  ptsCount = await page.evaluate(() => window.__fest.stage.measure.points.length);
  console.log('Points after 2nd click:', ptsCount);

  const measuredDist = await page.evaluate(() => {
    const pts = window.__fest.stage.measure.points;
    if (pts.length === 2) return pts[0].distanceTo(pts[1]);
    return null;
  });
  console.log('Measured portal distance:', measuredDist);
  await page.screenshot({ path: `${outDir}/12_measure_portal.jpg`, quality: 70, type: 'jpeg' });

  // Test Esc key exiting measure mode
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  console.log('Measure active after Esc:', await page.evaluate(() => window.__fest.stage.measure.active));

  // --- 2. Views testing (all 8 views) ---
  console.log('--- 2. Testing all 8 Views ---');
  await page.click('button.tab[data-tab="views"]');
  await page.waitForTimeout(100);

  const viewsList = await page.evaluate(() => window.__fest.views);
  console.log('Views list:', viewsList);

  for (const v of viewsList) {
    const vName = await page.evaluate((k) => window.__fest.stage.constructor ? (window.__fest.stage.constructor.name, window.__fest.setView(k), k) : k, v);
    await page.waitForTimeout(400);
    const curView = await page.evaluate(() => window.__fest.stage.view);
    const cameraType = await page.evaluate(() => window.__fest.stage.camera.isOrthographicCamera ? 'ortho' : 'persp');
    console.log(`View ${v}: active=${curView}, camera=${cameraType}`);
    await page.screenshot({ path: `${outDir}/view_${v}.jpg`, quality: 70, type: 'jpeg' });
  }

  // Reset to overview
  await page.evaluate(() => window.__fest.setView('overview'));
  await page.waitForTimeout(300);

  // --- 3. Layers toggling ---
  console.log('--- 3. Testing Layers Toggling ---');
  await page.click('button.tab[data-tab="layers"]');
  await page.waitForTimeout(100);

  const layerKeys = ['hall', 'walls', 'galleries', 'rigging', 'lights'];
  for (const lk of layerKeys) {
    const lBtn = page.locator(`.panel-layers button.tgl[data-id="l-${lk}"]`);
    // Toggle off
    await lBtn.click();
    await page.waitForTimeout(150);
    const isVisibleOff = await page.evaluate((k) => window.__fest.stage.layers[k], lk);
    console.log(`Layer ${lk} turned off:`, isVisibleOff === false);

    // Toggle on
    await lBtn.click();
    await page.waitForTimeout(150);
    const isVisibleOn = await page.evaluate((k) => window.__fest.stage.layers[k], lk);
    console.log(`Layer ${lk} turned on:`, isVisibleOn === true);
  }

  // --- 4. Help button '?' ---
  console.log('--- 4. Testing Help Button "?" ---');
  const helpBtn = page.locator('.top-actions button:has-text("?")');
  const helpBox = page.locator('.help');
  console.log('Help hidden initially:', await helpBox.getAttribute('hidden'));

  await helpBtn.click();
  await page.waitForTimeout(150);
  console.log('Help visible after clicking "?":', await helpBox.isVisible());
  const helpText = await helpBox.innerText();
  console.log('Help text contents:\n', helpText);
  await page.screenshot({ path: `${outDir}/13_help_dialog.jpg`, quality: 70, type: 'jpeg' });

  // Click 'Понятно'
  await helpBox.locator('button:has-text("Понятно")').click();
  await page.waitForTimeout(150);
  console.log('Help hidden after "Понятно":', !(await helpBox.isVisible()));

  // --- 5. Collapse side panel ---
  console.log('--- 5. Testing Collapsing Side Panel ---');
  const collapseBtn = page.locator('button.collapse');
  console.log('Side panel visible initially:', await page.locator('.side').isVisible());

  await collapseBtn.click();
  await page.waitForTimeout(300);
  const isHidden = await page.evaluate(() => document.body.classList.contains('side-hidden'));
  console.log('Body has side-hidden:', isHidden);
  const sideBox = await page.locator('.side').boundingBox();
  const viewportBox = await page.locator('.viewport').boundingBox();
  console.log('Side box after collapse:', sideBox, 'Viewport box:', viewportBox);
  await page.screenshot({ path: `${outDir}/14_side_panel_collapsed.jpg`, quality: 70, type: 'jpeg' });

  // Re-open side panel
  await collapseBtn.click();
  await page.waitForTimeout(300);
  console.log('Body has side-hidden after re-opening:', await page.evaluate(() => document.body.classList.contains('side-hidden')));

  // --- 6. Save / Load State file ---
  console.log('--- 6. Testing Save and Load State JSON ---');
  await page.click('button.tab[data-tab="views"]');
  await page.waitForTimeout(100);

  const saveFileBtn = page.locator('.panel-views button:has-text("💾 Сохранить состояние в файл")');
  const [downloadJson] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    saveFileBtn.click()
  ]);
  const jsonPath = path.resolve(outDir, 'fest-stage-state.json');
  await downloadJson.saveAs(jsonPath);
  console.log('Saved JSON state file to:', jsonPath);
  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log('JSON content keys:', Object.keys(jsonContent));

  // Change state (e.g. set Sh5 = 1.0)
  await page.evaluate(() => window.__fest.setHeight('Sh5', 1.0));
  console.log('Height before loading:', await page.evaluate(() => window.__fest.height('Sh5')));

  // Upload file via hidden input
  const fileInput = page.locator('.panel-views input[type="file"]');
  await fileInput.setInputFiles(jsonPath);
  await page.waitForTimeout(300);
  console.log('Height after loading JSON:', await page.evaluate(() => window.__fest.height('Sh5')));

  // --- 7. Laptop Resolution (1366x768) ---
  console.log('--- 7. Testing 1366x768 resolution ---');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.__fest.stage.resize());
  await page.waitForTimeout(300);

  // Check layout at 1366x768
  // Select Sh5 to open card on the right
  await page.click('button.tab[data-tab="rig"]');
  await page.waitForTimeout(100);
  await page.click('.rig-row[data-id="Sh5"] button.rig-name');
  await page.waitForTimeout(200);

  const cardBox = await page.locator('.card:not([hidden])').boundingBox();
  const sideBox768 = await page.locator('.side').boundingBox();
  const topbarBox = await page.locator('.topbar').boundingBox();
  console.log('At 1366x768: sideBox:', sideBox768, 'cardBox:', cardBox, 'topbarBox:', topbarBox);

  // Does the card overlap with the 3D scene? What is the width left between side and card?
  const remainingWidth = cardBox.x - (sideBox768.x + sideBox768.width);
  console.log('Remaining 3D width between left panel and right card at 1366px:', remainingWidth);

  await page.screenshot({ path: `${outDir}/15_laptop_1366x768_overview_sel.jpg`, quality: 70, type: 'jpeg' });

  // Open Help at 1366x768 to see where it appears
  await page.click('.top-actions button:has-text("?")');
  await page.waitForTimeout(150);
  const helpBox768 = await page.locator('.help').boundingBox();
  console.log('Help box at 1366x768:', helpBox768);
  await page.screenshot({ path: `${outDir}/16_laptop_help_overlap.jpg`, quality: 70, type: 'jpeg' });
  await page.click('.help button:has-text("Понятно")');

  console.log('Total console logs count:', logs.length);
  if (logs.length > 0) console.log('Console logs:', logs);

  await browser.close();
  console.log('Test 6 finished successfully.');
}

run().catch(e => {
  console.error('Test 6 failed:', e);
  process.exit(1);
});

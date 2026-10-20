import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT_DIR = 'review/r2/ui-desktop';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('=== TEST SCENARIO 4: PLAN + BLUEPRINT + PNG ===');

  // 1. Switch to Plan view
  await page.click('button[data-tab="views"]');
  await page.waitForTimeout(100);
  await page.click('button.view:has-text("План сверху")');
  await page.waitForTimeout(600);

  // Check bottom status text for ortho view
  const statusPlan = await page.evaluate(() => document.querySelector('.status')?.textContent);
  console.log('Status text on Plan view:', statusPlan);

  // 2. Turn on Blueprint mode and Dimensions
  // Click Blueprint in quick bar
  await page.click('.quick .tgl[data-id="q-bp"]');
  await page.waitForTimeout(100);

  // Open Layers panel and enable Dimensions and Grid
  await page.click('button[data-tab="layers"]');
  await page.waitForTimeout(100);
  await page.click('.panel-layers .tgl:has-text("Размеры")'); // Dimensions
  await page.waitForTimeout(100);
  await page.click('.panel-layers .tgl:has-text("Сетка 1 м")'); // Grid
  await page.waitForTimeout(200);

  // Check status of flags
  const flags = await page.evaluate(() => window.__fest.stage.flags);
  console.log('Flags after enabling blueprint, dims, grid:', flags);

  // Check if batten labels layout is 'plan'
  const labelsMode = await page.evaluate(() => {
    const it0 = window.__fest.stage.rigging.items.get('Sh0');
    const it1 = window.__fest.stage.rigging.items.get('Sh1');
    return {
      sh0X: it0.label?.position.x,
      sh1X: it1.label?.position.x,
      sh0DepthTest: it0.label?.material.depthTest,
      sh0RenderOrder: it0.label?.renderOrder
    };
  });
  console.log('Battens label ladder layout check:', labelsMode);

  // 3. Test LMB pan in Plan view
  console.log('--- Testing LMB drag panning in Plan view ---');
  const centerBefore = await page.evaluate(() => {
    return {
      x: window.__fest.stage.controls.target.x,
      z: window.__fest.stage.controls.target.z
    };
  });
  console.log('Target center before LMB drag:', centerBefore);

  // Perform LMB drag on canvas (use first canvas or viewport)
  const canvasBox = await page.locator('.viewport').boundingBox();
  const startX = canvasBox.x + canvasBox.width / 2;
  const startY = canvasBox.y + canvasBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(startX + 100, startY + 50, { steps: 5 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(150);

  const centerAfter = await page.evaluate(() => {
    return {
      x: window.__fest.stage.controls.target.x,
      z: window.__fest.stage.controls.target.z
    };
  });
  console.log('Target center after LMB drag:', centerAfter);
  const panned = Math.hypot(centerAfter.x - centerBefore.x, centerAfter.z - centerBefore.z) > 0.1;
  console.log('Did LMB pan camera in plan view?', panned);

  // Reset view to plan again
  await page.click('button[data-tab="views"]');
  await page.click('button.view:has-text("План сверху")');
  await page.waitForTimeout(600);

  // Take screenshot of the blueprint plan
  await page.screenshot({ path: `${OUT_DIR}/10_blueprint_plan_page.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // 4. Test PNG download
  console.log('--- Testing PNG Export ---');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.topbar button:has-text("📷 PNG")')
  ]);

  const downloadPath = `${OUT_DIR}/downloaded_blueprint_plan.png`;
  await download.saveAs(downloadPath);
  const fileStats = fs.statSync(downloadPath);
  console.log('Downloaded PNG file:', download.suggestedFilename(), 'Size:', fileStats.size, 'bytes');

  // Check section view status text as well
  await page.click('button.view:has-text("Разрез сбоку")');
  await page.waitForTimeout(600);
  const statusSection = await page.evaluate(() => document.querySelector('.status')?.textContent);
  console.log('Status text on Section view:', statusSection);
  await page.screenshot({ path: `${OUT_DIR}/11_blueprint_section_page.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // Switch back to overview and check status text
  await page.click('button.view:has-text("Общий вид")');
  await page.waitForTimeout(600);
  const statusOverview = await page.evaluate(() => document.querySelector('.status')?.textContent);
  console.log('Status text on Overview view:', statusOverview);

  await browser.close();
  console.log('=== TEST SCENARIO 4 FINISHED ===');
}

run().catch(console.error);

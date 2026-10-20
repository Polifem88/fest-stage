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

  console.log('=== TEST ADDITIONAL TOOLS: MEASURE, COLLAPSE, JSON ===');

  // 1. Tape measure
  console.log('--- 1. Testing Tape Measure ---');
  await page.click('button[data-tab="layers"]');
  await page.waitForTimeout(100);
  await page.click('.panel-layers .tgl[data-id="measure"]');
  await page.waitForTimeout(100);

  const measureActive = await page.evaluate(() => window.__fest.stage.measure.active);
  console.log('Measure active:', measureActive);

  // Switch to plan view to clearly measure portal width (-6.25 to +6.25 at portal d=0)
  await page.evaluate(() => window.__fest.setView('plan'));
  await page.waitForTimeout(300);

  // Click portal left and right
  const pLeft = await page.evaluate(() => window.__fest.project([-6.25, 0, 0]));
  const pRight = await page.evaluate(() => window.__fest.project([6.25, 0, 0]));

  await page.mouse.click(pLeft.x, pLeft.y);
  await page.waitForTimeout(100);
  await page.mouse.click(pRight.x, pRight.y);
  await page.waitForTimeout(150);

  const measureDist = await page.evaluate(() => {
    const pts = window.__fest.stage.measure.points;
    if (pts.length === 2) return pts[0].distanceTo(pts[1]).toFixed(2);
    return null;
  });
  console.log('Measure result distance:', measureDist);
  await page.screenshot({ path: `${OUT_DIR}/19_tape_measure.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // Escape turns off measure
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  console.log('Measure active after Escape:', await page.evaluate(() => window.__fest.stage.measure.active));

  // Reset to overview
  await page.evaluate(() => window.__fest.setView('overview'));
  await page.waitForTimeout(400);

  // 2. Collapse Side Panel
  console.log('--- 2. Testing Collapse Side Panel ---');
  const collapseBtn = page.locator('button.collapse');
  await collapseBtn.click();
  await page.waitForTimeout(300);

  const isHidden = await page.evaluate(() => document.body.classList.contains('side-hidden'));
  const viewportLeft = await page.evaluate(() => window.getComputedStyle(document.querySelector('.viewport')).left);
  console.log('Body side-hidden:', isHidden, 'Viewport left:', viewportLeft);
  await page.screenshot({ path: `${OUT_DIR}/20_panel_collapsed.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // Expand back
  await collapseBtn.click();
  await page.waitForTimeout(300);

  // 3. JSON export and import
  console.log('--- 3. Testing JSON State Save & Load ---');
  await page.click('button[data-tab="views"]');
  await page.waitForTimeout(100);

  // Change Sh5 to 2.34m
  await page.evaluate(() => window.__fest.setHeight('Sh5', 2.34));

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.panel-views button:has-text("💾 Сохранить состояние в файл")')
  ]);

  const jsonPath = `${OUT_DIR}/saved_state.json`;
  await download.saveAs(jsonPath);
  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log('Downloaded JSON Sh5 height:', jsonContent.heights?.Sh5);

  // Reset to initial
  await page.evaluate(() => window.__fest.setHeight('Sh5', 6.5));
  console.log('Sh5 after reset:', await page.evaluate(() => window.__fest.height('Sh5')));

  // Upload file
  const fileInput = page.locator('.panel-views input[type="file"]');
  await fileInput.setInputFiles(jsonPath);
  await page.waitForTimeout(200);

  console.log('Sh5 after loading JSON file:', await page.evaluate(() => window.__fest.height('Sh5')));

  await browser.close();
  console.log('=== TEST ADDITIONAL TOOLS FINISHED ===');
}

run().catch(console.error);

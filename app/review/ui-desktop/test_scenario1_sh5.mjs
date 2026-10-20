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

  console.log('Navigating to http://localhost:5173/desktop.html...');
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('App ready. Initial height of Sh5:', await page.evaluate(() => window.__fest.height('Sh5')));

  // Check UI structure for Sh5 in mechanics panel
  // Tab '⚙ Механика' is active by default.
  // Find row for Sh5
  const rowSelector = '.rig-row[data-id="Sh5"]';
  await page.waitForSelector(rowSelector);

  // 1. Method A: Slider in Mechanics panel
  console.log('--- Testing 1A: Slider in Mechanics panel ---');
  // Scroll row into view if needed
  await page.locator(rowSelector).scrollIntoViewIfNeeded();
  const sliderLocator = page.locator(`${rowSelector} input[type="range"]`);
  // Move slider to 2.0
  // In Playwright, setting slider via fill or evaluate or mouse drag on slider
  const sliderBox = await sliderLocator.boundingBox();
  console.log('Slider bounding box:', sliderBox);
  
  // Real user interaction: click or drag on slider
  // Slider min is 0.08, max is 8.5
  // Value 2.0 is at fraction (2.0 - 0.08) / (8.5 - 0.08) = 1.92 / 8.42 ≈ 0.228
  const targetX = sliderBox.x + sliderBox.width * ( (2.0 - 0.08) / (8.5 - 0.08) );
  const targetY = sliderBox.y + sliderBox.height / 2;
  await page.mouse.click(targetX, targetY);
  await page.waitForTimeout(200);
  const heightAfterSlider = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('Height after slider click:', heightAfterSlider);
  await page.screenshot({ path: `${outDir}/01_sh5_after_slider.jpg`, quality: 70, type: 'jpeg' });

  // Reset to rest
  await page.click('button:has-text("↺ Исходное")');
  await page.waitForTimeout(200);
  console.log('Height after reset:', await page.evaluate(() => window.__fest.height('Sh5')));

  // 2. Method B: Number input field
  console.log('--- Testing 1B: Number input field ---');
  const numInput = page.locator(`${rowSelector} input.num`);
  await numInput.click();
  // Select all and type '2.00' or '2'
  await page.keyboard.press('Control+A');
  await page.keyboard.type('2.00');
  await page.keyboard.press('Enter');
  // also blur
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  const heightAfterNum = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('Height after typing 2.00:', heightAfterNum);
  await page.screenshot({ path: `${outDir}/02_sh5_after_num_input.jpg`, quality: 70, type: 'jpeg' });

  // Test what happens if user enters comma: '2,5'
  await numInput.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('2,5');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  console.log('Height after typing 2,5:', await page.evaluate(() => window.__fest.height('Sh5')));

  // Reset
  await page.click('button:has-text("↺ Исходное")');
  await page.waitForTimeout(200);

  // 3. Method C: 3D drag of batten in scene
  console.log('--- Testing 1C: Dragging batten in 3D ---');
  // First, find where Sh5 is on screen using project()
  // Sh5 is at d = 3.65 (see rigging.js), height ~ 8.0, x along [-6..6]
  const sh5Pos = await page.evaluate(() => {
    const r = window.__fest.stage.rigging.get('Sh5');
    const h = window.__fest.height('Sh5');
    const d = r.cfg.d;
    return window.__fest.project([0, h, d]);
  });
  console.log('Projected Sh5 screen pos:', sh5Pos);

  // Move mouse over Sh5 to check cursor
  await page.mouse.move(sh5Pos.x, sh5Pos.y);
  await page.waitForTimeout(100);
  const cursorStyle = await page.evaluate(() => window.__fest.stage.renderer.domElement.style.cursor);
  console.log('Cursor style over Sh5:', cursorStyle);

  // Drag Sh5 downwards: mousedown, move mouse down by e.g. 150px, mouseup
  await page.mouse.down();
  await page.mouse.move(sh5Pos.x, sh5Pos.y + 150, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const heightAfterDrag = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('Height after 3D drag:', heightAfterDrag);
  await page.screenshot({ path: `${outDir}/03_sh5_after_3d_drag.jpg`, quality: 70, type: 'jpeg' });

  // Check if Sh5 became selected after drag
  const selectedAfterDrag = await page.evaluate(() => window.__fest.getState().selected || window.__fest.stage.selected);
  console.log('Selected object after drag:', selectedAfterDrag);

  // 4. Method D: Keyboard arrows after selection
  console.log('--- Testing 1D: Keyboard arrows ---');
  // If not selected or to be sure, select by clicking button 'Ш5' in table or in 3D
  await page.click(`${rowSelector} button.rig-name`);
  await page.waitForTimeout(100);
  console.log('Selected after clicking name button:', await page.evaluate(() => window.__fest.stage.selected));

  // Press ArrowDown multiple times
  const hBeforeArrows = await page.evaluate(() => window.__fest.height('Sh5'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const hAfterDown = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log(`Height before arrows: ${hBeforeArrows}, after 2x ArrowDown: ${hAfterDown} (diff: ${(hBeforeArrows - hAfterDown).toFixed(3)})`);

  // Press Shift+ArrowDown
  await page.keyboard.press('Shift+ArrowDown');
  const hAfterShiftDown = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log(`After Shift+ArrowDown: ${hAfterShiftDown} (diff: ${(hAfterDown - hAfterShiftDown).toFixed(3)})`);

  // Check info card on the right
  const cardVisible = await page.isVisible('.card:not([hidden])');
  console.log('Info card visible after selecting Sh5:', cardVisible);
  if (cardVisible) {
    const cardTitle = await page.textContent('.card-head b');
    const cardHeight = await page.textContent('.card-slider .big');
    console.log('Card title:', cardTitle, 'displayed height:', cardHeight);
    await page.screenshot({ path: `${outDir}/04_sh5_card.jpg`, quality: 70, type: 'jpeg' });

    // Can we adjust height from the card itself?
    const cardSlider = page.locator('.card-slider input[type="range"]');
    console.log('Card slider exists:', await cardSlider.count());
    // Click buttons ⤒, ↺, ⤓
    await page.click('.card .btn-row button:has-text("↺")');
    await page.waitForTimeout(200);
    console.log('Height after card reset button ↺:', await page.evaluate(() => window.__fest.height('Sh5')));
  }

  console.log('Console logs count:', logs.length);
  if (logs.length > 0) console.log('Logs:', logs);

  await browser.close();
  console.log('Test 1 finished successfully.');
}

run().catch(e => {
  console.error('Test 1 failed:', e);
  process.exit(1);
});

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

  console.log('=== TEST SCENARIO 1: SH5 COMPLETE RUN ===');

  // 1. Initial State
  const initH = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('1. Initial height:', initH);

  // 2. Hover in Overview
  const coordsSh5 = await page.evaluate(() => {
    const it = window.__fest.stage.rigging.items.get('Sh5');
    const h = window.__fest.stage.rigging.height('Sh5');
    return window.__fest.project([0, h, it.cfg.d]);
  });
  await page.mouse.move(coordsSh5.x, coordsSh5.y);
  await page.waitForTimeout(100);
  const hoverItem = await page.evaluate(() => window.__fest.stage.rigging._hov);
  console.log('2. Hover item at Sh5 coords:', hoverItem);
  await page.screenshot({ path: `${OUT_DIR}/01_sh5_hover.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // 3. 3D Drag in Overview
  await page.mouse.down();
  await page.mouse.move(coordsSh5.x, coordsSh5.y + 40, { steps: 5 });
  await page.waitForTimeout(50);
  const badgeInfo = await page.evaluate(() => {
    const b = document.querySelector('.drag-badge');
    return { text: b?.textContent, display: b ? window.getComputedStyle(b).display : null };
  });
  console.log('3. Drag badge text during drag:', badgeInfo);
  await page.screenshot({ path: `${OUT_DIR}/02_sh5_drag_badge.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // Drag down to ~2m
  await page.mouse.move(coordsSh5.x, coordsSh5.y + 175, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const hAfterDrag = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('3. Height after 3D drag in Overview:', hAfterDrag);

  // Check card title
  const cardTitle = await page.evaluate(() => document.querySelector('.card header, .card .card-head')?.textContent?.trim());
  console.log('Card title:', cardTitle);
  await page.screenshot({ path: `${OUT_DIR}/03_sh5_card_overview.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // 4. 3D Drag in Hall
  console.log('4. Testing Hall Drag');
  await page.click('button:has-text("↺ Исходное")');
  await page.waitForTimeout(100);
  await page.click('button[data-tab="views"]');
  await page.click('button.view:has-text("Из зала")');
  await page.waitForTimeout(700);

  // Pick at x=2.5 along Sh5
  const coordsHall25 = await page.evaluate(() => {
    const it = window.__fest.stage.rigging.items.get('Sh5');
    const h = window.__fest.stage.rigging.height('Sh5');
    return window.__fest.project([2.5, h, it.cfg.d]);
  });
  await page.mouse.move(coordsHall25.x, coordsHall25.y);
  await page.waitForTimeout(100);
  const hoverHall = await page.evaluate(() => window.__fest.stage.rigging._hov);
  console.log('Hover in hall at x=2.5:', hoverHall);

  await page.mouse.down();
  await page.mouse.move(coordsHall25.x, coordsHall25.y + 100, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const hAfterHallDrag = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('Height after 3D drag in Hall:', hAfterHallDrag);
  await page.screenshot({ path: `${OUT_DIR}/04_sh5_drag_hall.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // 5. Slider
  await page.click('button[data-tab="rig"]');
  await page.waitForTimeout(100);
  const sh5Row = page.locator('.rig-row[data-id="Sh5"]');
  const slider = sh5Row.locator('input[type=range]');
  const sliderBox = await slider.boundingBox();
  const targetX = sliderBox.x + sliderBox.width * ((2.0 - 0.08) / (8.5 - 0.08));
  await page.mouse.click(targetX, sliderBox.y + sliderBox.height / 2);
  await page.waitForTimeout(100);
  console.log('5. Height after slider:', await page.evaluate(() => window.__fest.height('Sh5')));

  // 6. Number input with dot and comma
  const numInput = sh5Row.locator('input.num');
  await numInput.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('3.50');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  console.log('6. Height after 3.50:', await page.evaluate(() => window.__fest.height('Sh5')));

  await numInput.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('2,00');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  console.log('6. Height after 2,00:', await page.evaluate(() => window.__fest.height('Sh5')));

  // 7. Keyboard arrows
  // Select Sh5
  await page.click('.rig-row[data-id="Sh5"] button.rig-name');
  await page.waitForTimeout(100);
  // Blur button so focus is on body, not on a button/tab
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(50);
  console.log('7. Height after ArrowDown (-0.05m):', await page.evaluate(() => window.__fest.height('Sh5')));
  await page.keyboard.press('Shift+ArrowUp');
  await page.waitForTimeout(50);
  console.log('7. Height after Shift+ArrowUp (+0.50m):', await page.evaluate(() => window.__fest.height('Sh5')));

  await page.screenshot({ path: `${OUT_DIR}/05_sh5_final.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  await browser.close();
  console.log('=== TEST SCENARIO 1 FINISHED ===');
}

run().catch(console.error);

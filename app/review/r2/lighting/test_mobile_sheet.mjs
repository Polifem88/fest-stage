import { chromium, devices } from '@playwright/test';
import path from 'node:path';

const OUT_DIR = 'review/r2/lighting/shots';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  // Портрет
  const ctxP = await browser.newContext({ ...devices['iPhone 14'] });
  const pPage = await ctxP.newPage();
  await pPage.goto('http://localhost:5173/mobile.html');
  await pPage.waitForFunction(() => window.__fest?.ready);

  // Клик по вкладке Свет
  await pPage.click('.mtab[data-tab="light"]');
  await pPage.waitForTimeout(300);
  await pPage.screenshot({ path: path.join(OUT_DIR, '21-mobile-portrait-sheet-light.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  console.log('Updated 21-mobile-portrait-sheet-light.jpg');

  // Раскрыть группу Софит 1 и скролл
  await pPage.evaluate(() => {
    const details = document.querySelectorAll('.panel-light details');
    if (details[1]) details[1].open = true; // С1
  });
  await pPage.waitForTimeout(200);
  await pPage.screenshot({ path: path.join(OUT_DIR, '21b-mobile-portrait-sheet-c1.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  console.log('Saved 21b-mobile-portrait-sheet-c1.jpg');

  // Тап по прибору № 38 (из фишек в шторке) с keepSheet
  await pPage.evaluate(() => {
    const chip = Array.from(document.querySelectorAll('.panel-light .chip')).find(c => c.textContent.trim() === '38');
    chip?.click();
  });
  await pPage.waitForTimeout(200);
  await pPage.screenshot({ path: path.join(OUT_DIR, '22-mobile-portrait-card.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  console.log('Updated 22-mobile-portrait-card.jpg');

  await ctxP.close();

  // Ландшафт
  const ctxL = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const lPage = await ctxL.newPage();
  await lPage.goto('http://localhost:5173/mobile.html');
  await lPage.waitForFunction(() => window.__fest?.ready);

  await lPage.click('.mtab[data-tab="light"]');
  await lPage.waitForTimeout(300);
  await lPage.screenshot({ path: path.join(OUT_DIR, '23-mobile-landscape-sheet.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  console.log('Updated 23-mobile-landscape-sheet.jpg');

  await ctxL.close();
  await browser.close();
}

run().catch(console.error);

import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // Click on 'Виды' tab
  await page.click('button.tab[data-tab="views"]');
  await page.waitForTimeout(100);

  // Check classes of all view buttons
  const viewBtns = await page.$$eval('.panel-views button.view', btns => {
    return btns.map(b => ({ text: b.textContent, class: b.className }));
  });
  console.log('View buttons on clean load:', viewBtns);

  await browser.close();
}

run();

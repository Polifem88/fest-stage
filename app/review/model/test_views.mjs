import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
});

const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
await page.goto('http://localhost:5173/desktop.html');
await page.waitForFunction(() => window.__fest?.ready);

await page.evaluate(() => {
  document.body.classList.add('side-hidden');
  window.__fest.stage.resize();
});

for (const v of ['booth', 'upperGallery', 'flyGallery']) {
  await page.evaluate((viewName) => {
    const f = window.__fest;
    f.setView(viewName);
    f.renderNow();
  }, v);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `review/model/view_${v}.jpg`, type: 'jpeg', quality: 75 });
}

await browser.close();

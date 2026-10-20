import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
});

const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
await page.goto('http://localhost:5173/desktop.html');
await page.waitForFunction(() => window.__fest?.ready);

// Booth view with labels: true
await page.evaluate(() => {
  document.body.classList.add('side-hidden');
  const f = window.__fest;
  f.setView('booth');
  f.flag('labels', true);
  f.renderNow();
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'review/r2/model/shots/view_booth_labels.jpg', type: 'jpeg', quality: 70 });

// FlyGallery view with labels: true
await page.evaluate(() => {
  const f = window.__fest;
  f.setView('flyGallery');
  f.flag('labels', true);
  f.renderNow();
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'review/r2/model/shots/view_flyGallery_labels.jpg', type: 'jpeg', quality: 70 });

// Hall view with selected rig Sh5
await page.evaluate(() => {
  const f = window.__fest;
  f.setView('hall');
  f.flag('labels', true);
  f.select({ kind: 'rig', id: 'Sh5' });
  f.renderNow();
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'review/r2/model/shots/view_hall_selected_Sh5.jpg', type: 'jpeg', quality: 70 });

await browser.close();
console.log('Rope label verification shots taken.');

import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
});

const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
await page.goto('http://localhost:5173/desktop.html');
await page.waitForFunction(() => window.__fest?.ready);

// 1. План сверху (blueprint + dims)
await page.evaluate(() => {
  document.body.classList.add('side-hidden');
  const f = window.__fest;
  f.setView('plan');
  f.flag('blueprint', true);
  f.flag('dims', true);
  f.flag('grid', true);
  f.flag('labels', true);
  f.flag('fixtureLabels', true);
  f.renderNow();
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'review/model/blueprint_plan.jpg', type: 'jpeg', quality: 80 });

// 2. Разрез сбоку (blueprint + dims)
await page.evaluate(() => {
  const f = window.__fest;
  f.setView('section');
  f.flag('blueprint', true);
  f.flag('dims', true);
  f.flag('grid', true);
  f.flag('labels', true);
  f.flag('fixtureLabels', false);
  f.renderNow();
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'review/model/blueprint_section.jpg', type: 'jpeg', quality: 80 });

// 3. Общий вид (чертёж)
await page.evaluate(() => {
  const f = window.__fest;
  f.setView('overview');
  f.flag('blueprint', true);
  f.flag('dims', false);
  f.flag('grid', false);
  f.renderNow();
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'review/model/blueprint_overview.jpg', type: 'jpeg', quality: 80 });

console.log('Blueprint screenshots captured.');
await browser.close();

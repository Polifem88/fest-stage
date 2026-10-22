import { chromium } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const desktopUrl = pathToFileURL(path.resolve('dist/desktop.html')).href;
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(desktopUrl);
await page.waitForFunction(() => window.__fest?.ready);

// Select Sh5 on Big stage
await page.evaluate(() => {
  window.__fest.select({ kind: 'rig', id: 'Sh5' });
});

console.log('Selected on Big:', await page.evaluate(() => window.__fest.stage.selected));
console.log('Card title on Big:', await page.evaluate(() => document.querySelector('.card:not([hidden]) b')?.innerText));

// Now switch to Chamber while Sh5 is selected
await page.evaluate(async () => {
  await window.__fest.loadVenue('chamber');
});

console.log('Selected on Chamber after switch:', await page.evaluate(() => window.__fest.stage.selected));
console.log('Card hidden on Chamber:', await page.evaluate(() => document.querySelector('.card')?.hidden));

// Now select fixture К5 on Chamber
await page.evaluate(() => {
  window.__fest.selectFixture('К5');
});
console.log('Selected on Chamber:', await page.evaluate(() => window.__fest.stage.selected));
console.log('Card title on Chamber:', await page.evaluate(() => document.querySelector('.card:not([hidden]) b')?.innerText));

// Switch back to Big
await page.evaluate(async () => {
  await window.__fest.loadVenue('big');
});

console.log('Selected on Big after switch:', await page.evaluate(() => window.__fest.stage.selected));
console.log('Card hidden on Big:', await page.evaluate(() => document.querySelector('.card')?.hidden));

await browser.close();

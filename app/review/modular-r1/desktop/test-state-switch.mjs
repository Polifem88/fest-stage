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

// Save Big state
const bigState = await page.evaluate(() => {
  window.__fest.setHeight('Sh5', 2.2);
  return window.__fest.getState();
});
console.log('Big state venue:', bigState.venue);

// Switch to Chamber
await page.evaluate(async () => {
  await window.__fest.loadVenue('chamber');
});
console.log('Current venue:', await page.evaluate(() => window.__fest.venue()));

// Save Chamber state
const chamberState = await page.evaluate(() => {
  window.__fest.setView('trusses');
  return window.__fest.getState();
});
console.log('Chamber state venue:', chamberState.venue);

// Now load Big state JSON via openState
const switchResult1 = await page.evaluate(async (st) => {
  return await window.__fest.stage.openState(st);
}, bigState);
console.log('Switch to Big result:', switchResult1);
console.log('Venue after loading Big state:', await page.evaluate(() => window.__fest.venue()));
console.log('Sh5 height after loading Big state:', await page.evaluate(() => window.__fest.height('Sh5')));

// Now load Chamber state JSON via openState
const switchResult2 = await page.evaluate(async (st) => {
  return await window.__fest.stage.openState(st);
}, chamberState);
console.log('Switch to Chamber result:', switchResult2);
console.log('Venue after loading Chamber state:', await page.evaluate(() => window.__fest.venue()));
console.log('View after loading Chamber state:', await page.evaluate(() => window.__fest.getState().view));

await browser.close();

import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('--- DIAGNOSTIC: HALL DRAG & ARROW KEYS ---');

  // 1. Switch to hall
  await page.evaluate(() => window.__fest.setView('hall'));
  await page.waitForTimeout(500);

  const coords = await page.evaluate(() => {
    const it = window.__fest.stage.rigging.items.get('Sh5');
    const h = window.__fest.stage.rigging.height('Sh5');
    return window.__fest.project([0, h, it.cfg.d]);
  });
  console.log('Sh5 hall projected:', coords);

  // Check pick at coords
  const pickRes = await page.evaluate((c) => {
    const el = window.__fest.stage.renderer.domElement;
    const r = el.getBoundingClientRect();
    const ndc = { x: ((c.x - r.left) / r.width) * 2 - 1, y: -((c.y - r.top) / r.height) * 2 + 1 };
    const hit = window.__fest.stage.pick(ndc);
    return hit;
  }, coords);
  console.log('Pick at Sh5 in hall:', pickRes);

  // Set up event listener on window for drag events
  await page.evaluate(() => {
    window._dragEvents = [];
    window.__fest.stage.on('drag', (d) => window._dragEvents.push(d));
  });

  // Drag in hall
  await page.mouse.move(coords.x, coords.y);
  await page.mouse.down();
  await page.mouse.move(coords.x, coords.y + 100, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.up();

  const dragEvents = await page.evaluate(() => window._dragEvents);
  console.log('Drag events in hall:', dragEvents.length, dragEvents.slice(0, 3));
  console.log('Sh5 height after hall drag:', await page.evaluate(() => window.__fest.height('Sh5')));

  // 2. Check Arrow keys
  console.log('--- Testing Arrow Keys ---');
  await page.evaluate(() => window.__fest.select({ kind: 'rig', id: 'Sh5' }));
  const initialH = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('Initial H before arrow:', initialH);

  // Check activeElement
  console.log('Active element before arrow:', await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 50)));

  // Press ArrowDown
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(50);
  console.log('H after ArrowDown:', await page.evaluate(() => window.__fest.height('Sh5')));

  // Press Shift+ArrowUp
  await page.keyboard.press('Shift+ArrowUp');
  await page.waitForTimeout(50);
  console.log('H after Shift+ArrowUp:', await page.evaluate(() => window.__fest.height('Sh5')));

  // Now test if tablist was focused:
  await page.focus('button[data-tab="rig"]');
  console.log('Active element on tab:', await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 50)));
  await page.keyboard.press('ArrowDown');
  console.log('H after ArrowDown when tab focused (should not change batten!):', await page.evaluate(() => window.__fest.height('Sh5')));

  await browser.close();
}

run().catch(console.error);

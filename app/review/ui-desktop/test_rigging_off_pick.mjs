import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // Focus on fixture 53 first
  await page.evaluate(() => window.__fest.stage.focusFixture(34));
  await page.waitForTimeout(500);

  // Now check pick of fixture 53 with rigging ON vs OFF
  const resOn = await page.evaluate(() => {
    const fix = window.__fest.stage.fixtures.byNo.get('53');
    const pos = window.__fest.stage.fixtures.mountPos(fix);
    const pt = window.__fest.project([pos.x, pos.y, -pos.z]);
    const el = window.__fest.stage.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const ndc = {
      x: ((pt.x - rect.left) / rect.width) * 2 - 1,
      y: -((pt.y - rect.top) / rect.height) * 2 + 1
    };
    return { pt, hit: window.__fest.stage.pick(ndc) };
  });
  console.log('Pick with rigging ON:', resOn);

  // Now turn rigging layer OFF
  await page.evaluate(() => window.__fest.layer('rigging', false));
  const resOff = await page.evaluate(() => {
    const fix = window.__fest.stage.fixtures.byNo.get('53');
    const pos = window.__fest.stage.fixtures.mountPos(fix);
    const pt = window.__fest.project([pos.x, pos.y, -pos.z]);
    const el = window.__fest.stage.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const ndc = {
      x: ((pt.x - rect.left) / rect.width) * 2 - 1,
      y: -((pt.y - rect.top) / rect.height) * 2 + 1
    };
    return { pt, hit: window.__fest.stage.pick(ndc) };
  });
  console.log('Pick with rigging OFF:', resOff);

  await browser.close();
}

run();

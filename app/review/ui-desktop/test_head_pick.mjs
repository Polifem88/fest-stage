import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  const res = await page.evaluate(() => {
    const fix = window.__fest.stage.fixtures.byNo.get('53');
    const pos = window.__fest.stage.fixtures.mountPos(fix);
    const headY = pos.y - (fix.hasBase ? 0.32 : 0.22);
    const pt = window.__fest.project([pos.x, headY, -pos.z]);
    const el = window.__fest.stage.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const ndc = {
      x: ((pt.x - rect.left) / rect.width) * 2 - 1,
      y: -((pt.y - rect.top) / rect.height) * 2 + 1
    };
    const hitWithRig = window.__fest.stage.pick(ndc);
    window.__fest.layer('rigging', false);
    const hitWithoutRig = window.__fest.stage.pick(ndc);
    return { pt, hitWithRig, hitWithoutRig, headY, mountY: pos.y };
  });

  console.log('Result aiming at fixture head:', res);

  await browser.close();
}

run();

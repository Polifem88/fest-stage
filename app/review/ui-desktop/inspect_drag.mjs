import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  const debug = await page.evaluate(() => {
    const r = window.__fest.stage.rigging.get('Sh5');
    const h = window.__fest.height('Sh5');
    const d = r.cfg.d;
    const pt = window.__fest.project([0, h, d]);
    
    const el = window.__fest.stage.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const ndc = {
      x: ((pt.x - rect.left) / rect.width) * 2 - 1,
      y: -((pt.y - rect.top) / rect.height) * 2 + 1
    };
    const hit = window.__fest.stage.pick(ndc);

    const hitsAll = [];
    const ray = window.__fest.stage.ray;
    ray.setFromCamera(ndc, window.__fest.stage.camera);
    const targets = [];
    for (const it of window.__fest.stage.rigging.items.values()) targets.push(it.hit);
    const inters = ray.intersectObjects(targets, false);
    for (const i of inters) {
      hitsAll.push({ id: i.object.userData.pick?.id, dist: i.distance });
    }

    return { pt, hit, hitsAll };
  });

  console.log('Projected point and pick:', debug);

  // Test at different x coordinates along the batten
  for (const x of [-3, -1, 1, 3]) {
    const res = await page.evaluate((x) => {
      const r = window.__fest.stage.rigging.get('Sh5');
      const h = window.__fest.height('Sh5');
      const d = r.cfg.d;
      const pt = window.__fest.project([x, h, d]);
      const el = window.__fest.stage.renderer.domElement;
      const rect = el.getBoundingClientRect();
      const ndc = {
        x: ((pt.x - rect.left) / rect.width) * 2 - 1,
        y: -((pt.y - rect.top) / rect.height) * 2 + 1
      };
      const hit = window.__fest.stage.pick(ndc);
      return { x, pt, hit };
    }, x);
    console.log(`x=${x}:`, res);
  }

  await browser.close();
}

run();

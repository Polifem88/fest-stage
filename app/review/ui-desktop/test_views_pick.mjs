import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('Testing picking and dragging in different views...');

  // Views: overview, hall, booth, stageToHall, section
  for (const v of ['overview', 'hall', 'booth', 'stageToHall', 'section']) {
    await page.evaluate((view) => window.__fest.setView(view), v);
    await page.waitForTimeout(400);

    const check = await page.evaluate(() => {
      const r = window.__fest.stage.rigging.get('Sh5');
      const h = window.__fest.height('Sh5');
      const d = r.cfg.d;
      // Project center, left, right
      const pts = [
        { label: 'center', pos: [0, h, d] },
        { label: 'left_near_label', pos: [-5.5, h, d] },
        { label: 'right_near_label', pos: [5.5, h, d] }
      ];
      return pts.map(p => {
        const pt = window.__fest.project(p.pos);
        const el = window.__fest.stage.renderer.domElement;
        const rect = el.getBoundingClientRect();
        const ndc = {
          x: ((pt.x - rect.left) / rect.width) * 2 - 1,
          y: -((pt.y - rect.top) / rect.height) * 2 + 1
        };
        const hit = window.__fest.stage.pick(ndc);
        return { label: p.label, pt, hit: hit?.id };
      });
    });

    console.log(`View ${v}:`, check);
  }

  await browser.close();
}

run();

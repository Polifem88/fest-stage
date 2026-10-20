import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('=== Testing 3D click on fixtures ===');

  // Let's test fixtures in different groups:
  // e.g. Fixture 1 on C0, Fixture 53 on C2, Fixture on Bridge
  const testFixtures = [1, 15, 34, 53, 102];
  for (const fNo of testFixtures) {
    const f = await page.evaluate((no) => {
      const fix = window.__fest.stage.fixtures.byNo.get(String(no));
      if (!fix) return null;
      const pos = window.__fest.stage.fixtures.mountPos(fix);
      const pt = window.__fest.project([pos.x, pos.y, -pos.z]); // wait! mountPos returns Three.js pos (x, y, z where z is negative depth)
      // in project(), argument is [x, y, d] where d = -z!
      const pt2 = window.__fest.project([pos.x, pos.y, -pos.z]);
      const el = window.__fest.stage.renderer.domElement;
      const rect = el.getBoundingClientRect();
      const ndc = {
        x: ((pt2.x - rect.left) / rect.width) * 2 - 1,
        y: -((pt2.y - rect.top) / rect.height) * 2 + 1
      };
      const hit = window.__fest.stage.pick(ndc);
      return { no, idx: fix.idx, group: fix.group, pt: pt2, hit };
    }, fNo);

    console.log(`Fixture #${fNo}:`, f);

    // Try real mouse click at pt
    if (f && f.pt) {
      await page.mouse.click(f.pt.x, f.pt.y);
      await page.waitForTimeout(200);
      const sel = await page.evaluate(() => window.__fest.stage.selected);
      const desc = await page.evaluate(() => window.__fest.describe());
      console.log(`After click on #${fNo} pos: selected=`, sel, 'card title=', desc?.title);
    }
  }

  await browser.close();
}

run();

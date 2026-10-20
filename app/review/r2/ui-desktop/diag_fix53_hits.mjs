import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // Focus fixture 53
  await page.evaluate(() => {
    const f = window.__fest.stage.fixtures.byNo.get('53');
    window.__fest.stage.focusFixture(f.idx);
  });
  await page.waitForTimeout(900);

  const debugHits = await page.evaluate(() => {
    const st = window.__fest.stage;
    const f = st.fixtures.byNo.get('53');
    const p = st.fixtures.mountPos(f);
    // Project head position vs mount position
    const headP = f.world ? f.world.head : p;
    const proj = window.__fest.project([headP.x, headP.y, -headP.z]);
    const el = st.renderer.domElement;
    const r = el.getBoundingClientRect();
    const ndc = { x: ((proj.x - r.left) / r.width) * 2 - 1, y: -((proj.y - r.top) / r.height) * 2 + 1 };
    
    st.ray.setFromCamera(ndc, st.camera);
    const targets = [];
    if (st.layers.rigging) for (const it of st.rigging.items.values()) targets.push(it.hit);
    if (st.layers.lights) targets.push(...Object.values(st.fixtures.shapes));
    const hits = st.ray.intersectObjects(targets, false);

    const W = el.clientWidth, H = el.clientHeight;
    const cx = ((ndc.x + 1) / 2) * W, cy = ((1 - ndc.y) / 2) * H;
    const toPx = (v) => { const q = v.clone().project(st.camera); return [((q.x + 1) / 2) * W, ((1 - q.y) / 2) * H, q.z]; };
    
    const hitsDetails = hits.map(h => {
      const isRig = !!h.object.userData.pick;
      const isFx = !!h.object.userData.pickInstanced;
      let rigId = null, distToAxis = null;
      if (isRig) {
        rigId = h.object.userData.pick.id;
        const [a, b] = st.rigging.axis(rigId);
        const A = toPx(a), B = toPx(b);
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const t = Math.max(0, Math.min(1, ((cx - A[0]) * dx + (cy - A[1]) * dy) / (dx * dx + dy * dy || 1)));
        distToAxis = Math.hypot(cx - (A[0] + t * dx), cy - (A[1] + t * dy));
      }
      let fxNo = null;
      if (isFx) {
        const idx = h.object.userData.pickInstanced.map[h.instanceId];
        fxNo = st.fixtures.list[idx].no;
      }
      return {
        distance: h.distance,
        isRig, rigId, distToAxis,
        isFx, fxNo
      };
    });

    const finalPick = st.pick(ndc);
    return { proj, headP, hitsDetails, finalPick };
  });

  console.log('Diagnostic hits at fixture 53:', JSON.stringify(debugHits, null, 2));

  await browser.close();
}

run().catch(console.error);

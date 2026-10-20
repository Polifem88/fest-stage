// Точность выбора в 3D: для каждого видимого штанкета и прибора — «тык» в его экранную точку.
// Считаются только цели, которые на этом луче видны первыми (не загорожены).
// Запуск из app/ при работающем dev-сервере: node scripts/pickcheck.mjs [desktop|mobile]
import { chromium, devices } from '@playwright/test';
const which = process.argv[2] || 'desktop';
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(which === 'mobile' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1920, height: 1080 } });
const p = await ctx.newPage();
await p.goto(`http://localhost:5173/${which}.html`);
await p.waitForFunction(() => window.__fest?.ready);
const res = await p.evaluate(() => {
  const f = window.__fest, st = f.stage;
  const out = {};
  for (const view of ['overview', 'hall', 'booth', 'upperGallery', 'stageToHall']) {
    f.setView(view); st.render();
    const el = st.renderer.domElement, W = el.clientWidth, H = el.clientHeight;
    const ndcOf = (v) => { const q = v.clone().project(st.camera); return q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 ? { x: q.x, y: q.y } : null; };
    // видна ли цель: первый непрозрачный объект на луче — она сама
    const occ = [];
    st.scene.traverseVisible((o) => { if (o.isMesh && o.material && o.material.visible !== false && !o.material.transparent && !['beams', 'pools', 'lenses'].includes(o.name)) occ.push(o); });
    const firstHit = (n) => { st.ray.setFromCamera(n, st.camera); return st.ray.intersectObjects(occ, false)[0]; };
    const visRig = (n, it) => firstHit(n)?.object === it.visual;
    const visFx = (n, fx) => { const h = firstHit(n); return h && h.object.userData.pickInstanced && h.object.userData.pickInstanced.map[h.instanceId] === fx.idx; };
    let rigOk = 0, rigN = 0, fxOk = 0, fxN = 0; const miss = [];
    for (const [id, it] of st.rigging.items) {
      if (it.cfg.kind === 'side') continue;
      for (const x of [-3.3, 1.1, 4.4]) {
        const v = new it.group.position.constructor(x, it.h, -it.cfg.d);
        const n = ndcOf(v); if (!n || !visRig(n, it)) continue;
        rigN++; const hit = st.pick(n);
        if (hit?.kind === 'rig' && hit.id === id) rigOk++; else if (miss.length < 6) miss.push(`${id}@${x}→${hit ? hit.id ?? '#' + st.fixtures.list[hit.idx].no : '—'}`);
      }
    }
    for (const fx of st.fixtures.list) {
      if (fx.hidden || !fx.world) continue;
      const n = ndcOf(fx.world.head); if (!n || !visFx(n, fx)) continue;
      fxN++; const hit = st.pick(n);
      if (hit?.kind === 'fixture' && hit.idx === fx.idx) fxOk++;
    }
    out[view] = { rig: `${rigOk}/${rigN}`, fixtures: `${fxOk}/${fxN}`, miss: miss.join(' ') };
  }
  return out;
});
for (const [v, r] of Object.entries(res)) console.log(which, v.padEnd(13), 'штанкеты', r.rig.padEnd(8), 'приборы', r.fixtures.padEnd(8), r.miss);
await browser.close();

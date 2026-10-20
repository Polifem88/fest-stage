// Быстрая проверка: страница открывается без ошибок, делает пару снимков.
// Запуск: node scripts/smoke.mjs [desktop|mobile] [view1,view2,...]
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const page = process.argv[2] || 'desktop';
const views = (process.argv[3] || 'overview').split(',');
const out = process.argv[4] || 'review/shots/smoke';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
// Превью маленькие (JPEG, ~960 px), чтобы не раздувать контекст агента.
const ctx = await browser.newContext(page === 'mobile' ? { ...devices['iPhone 13'], deviceScaleFactor: 1 } : { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
await p.goto(`${process.env.FEST_URL || 'http://localhost:5173/'}${page}.html`);
await p.waitForFunction(() => window.__fest?.ready, null, { timeout: 120000 }).catch(() => {});
console.log(`ready in ${Date.now() - t0} ms`);
for (const v of views) {
  const [view, ...mods] = v.split('+');
  await p.evaluate(([view, mods]) => {
    const f = window.__fest;
    if (!f) return;
    f.setView(view);
    for (const m of mods) {
      if (m === 'bp') f.flag('blueprint', true);
      if (m === 'nobp') f.flag('blueprint', false);
      if (m === 'dims') f.flag('dims', true);
      if (m === 'off') f.light('all', false);
      if (m === 'on') f.light('all', true);
      if (m === 'house') f.flag('house', true);
      if (m === 'noduty') f.flag('duty', false);
      if (m === 'nums') f.flag('fixtureLabels', true);
      if (m === 'nohaze') f.flag('haze', false);
      if (m === 'nopools') f.stage.fixtures.setPools(false);
      if (m === 'flat') f.stage.lighting.setStage(0);
      if (m === 'low') { for (const id of ['Sh3', 'Sh5', 'Sh9']) f.setHeight(id, 2); f.setHeight('C2', 3); }
    }
    f.renderNow();
  }, [view, mods]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${page}-${v.replace(/\+/g, '_')}.jpg`, type: 'jpeg', quality: 70 });
}
const stats = await p.evaluate(() => window.__fest?.stats());
console.log('stats', JSON.stringify(stats));
console.log(errors.length ? errors.slice(0, 30).join('\n') : 'no console errors');
await browser.close();

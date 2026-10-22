// Проверка опубликованного сайта: страницы открываются, сцена строится, ошибок нет.
import { chromium, devices } from '@playwright/test';
const BASE = 'https://polifem88.github.io/fest-stage/';
const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, ctxOpts, page] of [
  ['index-desktop', { viewport: { width: 1280, height: 800 } }, ''],
  ['index-phone', { ...devices['iPhone 13'] }, ''],
  ['desktop', { viewport: { width: 1600, height: 900 } }, 'desktop.html'],
  ['mobile', { ...devices['iPhone 13'] }, 'mobile.html'],
]) {
  const ctx = await browser.newContext(ctxOpts);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const t0 = Date.now();
  const resp = await p.goto(BASE + page);
  let info = `HTTP ${resp.status()}`;
  if (page) {
    await p.waitForFunction(() => window.__fest?.ready, null, { timeout: 120000 });
    const st = await p.evaluate(() => { window.__fest.setView('hall'); window.__fest.renderNow(); return window.__fest.stats(); });
    info += `, сцена готова за ${Date.now() - t0} мс, ${st.calls} вызовов`;
    // ссылка с состоянием открывается
    const url = await p.evaluate(() => { window.__fest.setHeight('Sh5', 2); window.__fest.light('all', false); window.__fest.light('C2', true); return window.__fest.stage.shareUrl(); });
    const p2 = await ctx.newPage();
    await p2.goto(url);
    await p2.waitForFunction(() => window.__fest?.ready, null, { timeout: 120000 });
    info += `; по ссылке Ш5 = ${await p2.evaluate(() => window.__fest.height('Sh5'))} м`;
  } else {
    info += `, сцен на стартовой: ${await p.locator('.venue-card').count()}; ${await p.locator('#rec').textContent()}`;
  }
  await p.screenshot({ path: `${out}/live-${name}.jpg`, type: 'jpeg', quality: 70 });
  console.log(name.padEnd(14), info, errs.length ? `ОШИБКИ: ${errs.join(' | ')}` : 'без ошибок');
  await ctx.close();
}
await browser.close();

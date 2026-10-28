// Общие помощники для браузерных тестов (Playwright).
import { expect } from '@playwright/test';

/** Сообщения консоли, которые не являются ошибками приложения (шум программного WebGL). */
const NOISE = [/GPU stall due to ReadPixels/i, /GL Driver Message/i, /WebGL.*performance/i, /Automatic fallback to software WebGL/i];

/** Открыть страницу приложения и дождаться готовности сцены (window.__fest.ready). */
export async function openApp(page, url) {
  const log = { errors: [], warnings: [] };
  page.on('console', (m) => {
    const t = m.text();
    if (NOISE.some((r) => r.test(t))) return;
    if (m.type() === 'error') log.errors.push(t);
    else if (m.type() === 'warning') log.warnings.push(t);
  });
  page.on('pageerror', (e) => log.errors.push(`[pageerror] ${e.message}`));
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__fest?.ready, null, { timeout: 180_000 });
  log.readyMs = Date.now() - t0;
  return log;
}

/** Применить вид и модификаторы. Пример: 'hall+off+house', 'plan+lo-arena'. Те же коды, что в scripts/smoke.mjs. */
export async function applyShot(page, spec) {
  await page.evaluate((spec) => {
    const [view, ...mods] = spec.split('+');
    const f = window.__fest;
    // сброс к исходному состоянию, чтобы снимки не влияли друг на друга
    f.stage.allTo('rest');
    f.light('all', true);
    f.portable('off', 8);
    f.flag('blueprint', false); f.flag('dims', false); f.flag('house', false); f.flag('duty', true);
    f.flag('fixtureLabels', false); f.flag('grid', false);
    f.flag('haze', f.stage.profile.haze);
    f.select(null);
    // трансформируемый зал — к планировке по умолчанию (у площадок без планировок — ничего)
    if (f.layout?.()) f.setLayout({ id: f.stage.venue.layouts.default });
    // всплывающие подсказки от прошлого снимка убираем (иначе попадают в следующие кадры)
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    f.setView(view);
    for (const m of mods) {
      if (m === 'bp') f.flag('blueprint', true);
      if (m === 'dims') f.flag('dims', true);
      if (m === 'grid') f.flag('grid', true);
      if (m === 'off') f.light('all', false);
      if (m === 'house') f.flag('house', true);
      if (m === 'noduty') f.flag('duty', false);
      if (m === 'nums') f.flag('fixtureLabels', true);
      if (m === 'haze') f.flag('haze', true);
      if (m === 'nohaze') f.flag('haze', false);
      if (m === 'pfloor') f.portable('floor', 8);
      if (m === 'pstand') f.portable('stand', 8);
      if (m === 'onlyC2') { f.light('all', false); f.light('C2', true); }
      if (m === 'low') { for (const id of ['Sh3', 'Sh5', 'Sh9']) f.setHeight(id, 2); f.setHeight('C2', 3); }
      if (m === 'sel53') f.selectFixture(53);
      if (m === 'selSh5') f.select({ kind: 'rig', id: 'Sh5' });
      if (m.startsWith('lo-')) f.setLayout({ id: m.slice(3) }); // планировка зала: lo-traverse
    }
    f.renderNow();
  }, spec);
  // дать интерфейсу (карточка, подписи) перерисоваться
  await page.waitForTimeout(300);
}

/**
 * Яркость кадра WebGL: среднее и разброс по уменьшенной копии холста.
 * Пустой (однотонный) кадр даёт разброс ≈ 0.
 */
export async function canvasStats(page) {
  return page.evaluate(() => {
    const st = window.__fest.stage;
    st.render();
    const src = st.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = 96; c.height = 54;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0, s2 = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += y; s2 += y * y; }
    const mean = s / n;
    return { mean: +mean.toFixed(1), std: +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(1) };
  });
}

/** В конце теста: ошибок в консоли быть не должно. */
export function expectNoErrors(log) {
  expect(log.errors, `ошибки в консоли:\n${log.errors.join('\n')}`).toEqual([]);
}

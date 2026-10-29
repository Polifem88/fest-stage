// Шаг 6. Самопроверка: производительность и собранные файлы.
//  • FPS при замедленном в 4 раза процессоре (цель ≥ 30) — на телефонах и на десктопе;
//    время процессора на кадр < 33 мс; на телефонах — бюджет вызовов отрисовки и треугольников.
//  • dist/desktop.html и dist/mobile.html ≤ 1,3 МБ (все площадки каталога), index.html ≤ 0,1 МБ.
//  • Собранные файлы открываются двойным кликом (file://) без интернета и без ошибок — все площадки.
// Результаты: review/shots/<раунд>/<проект>/perf.json
import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openApp, applyShot, expectNoErrors } from './helpers.js';

const ROUND = process.env.ROUND || 'r1-self';
const CPU_SLOWDOWN = 4;
const FPS_MIN = 30;
const CATALOG_MAX_MB = 1.3;
/** Бюджеты для графики телефона среднего уровня (видеокарту телефона здесь не измерить). */
const MOBILE_BUDGET = { calls: 150, triangles: 200_000 };
const DIST = resolve('dist');

// FPS меряем на НАСТОЯЩЕЙ видеокарте: программный рендер SwiftShader упирается в сам себя
// (замедление процессора ×4 на нём почти не меняет FPS), и замер ничего не говорит о коде.
// Замедление ×4 имитирует слабый процессор телефона. FEST_SOFT=1 — принудительно SwiftShader.
const GPU_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'];
const SOFT_ARGS = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
test.use({ launchOptions: { args: process.env.FEST_SOFT ? SOFT_ARGS : GPU_ARGS } });

test.describe('FPS', () => {
  test('FPS при замедленном процессоре', async ({ page, context }, info) => {
    const mobile = !!info.project.use.isMobile;
    const log = await openApp(page, mobile ? 'mobile.html' : 'desktop.html');
    const gpu = await page.evaluate(() => {
      const gl = window.__fest.stage.renderer.getContext();
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'неизвестно';
    });
    const software = /SwiftShader|llvmpipe|Software/i.test(gpu);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

    // haze — дымка: на телефоне по умолчанию выключена, замер с ней — для сведения
    const cases = mobile ? ['overview', 'hall', 'plan', 'section', 'hall+haze', 'overview+low'] : ['overview', 'hall', 'flyGallery', 'plan+bp'];
    // остальные площадки каталога: общий вид и план (venue:вид)
    const otherCases = ['chamber:overview', 'chamber:plan', 'roof:overview', 'roof:plan'];
    const results = [];
    for (const spec of [...cases, ...otherCases]) {
      const [venue, shot] = spec.includes(':') ? spec.split(':') : ['big', spec];
      if (await page.evaluate(() => window.__fest.venue()) !== venue) await page.evaluate((v) => window.__fest.loadVenue(v), venue);
      await applyShot(page, shot);
      await page.evaluate(() => window.__fest.fps(800)); // прогрев
      const r = await page.evaluate(() => window.__fest.fps(3000));
      // время процессора на один кадр (без ожидания видеокарты), при замедлении ×4
      const cpuMs = await page.evaluate(() => {
        const s = window.__fest.stage;
        const t = performance.now();
        for (let i = 0; i < 20; i++) s.render();
        return (performance.now() - t) / 20;
      });
      results.push({ spec, fps: +r.fps.toFixed(1), cpuMs: +cpuMs.toFixed(2), calls: r.calls, triangles: r.triangles });
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const dir = `review/shots/${ROUND}/${info.project.name}`;
    mkdirSync(dir, { recursive: true });
    const out = { project: info.project.name, gpu, viewport: page.viewportSize(), cpuSlowdown: CPU_SLOWDOWN, readyMs: log.readyMs, results };
    writeFileSync(`${dir}/perf.json`, JSON.stringify(out, null, 1));
    console.log(`[${info.project.name}] ${gpu}; готовность ${log.readyMs} мс\n` + results.map((r) => `   ${r.spec}: ${r.fps} FPS, кадр на процессоре ${r.cpuMs} мс, ${r.calls} вызовов, ${(r.triangles / 1000).toFixed(0)}k треуг.`).join('\n'));
    for (const r of results) info.annotations.push({ type: 'FPS', description: `${r.spec}: ${r.fps} FPS, ${r.cpuMs} мс/кадр, ${r.calls} вызовов` });

    if (software) {
      info.annotations.push({ type: 'внимание', description: `видеокарта недоступна (${gpu}) — FPS только для сведения` });
    } else {
      for (const r of results.filter((r) => !r.spec.includes('haze'))) {
        expect.soft(r.fps, `${r.spec}: ${r.fps} FPS при замедлении ×${CPU_SLOWDOWN}`).toBeGreaterThanOrEqual(FPS_MIN);
      }
    }
    for (const r of results) {
      // кадр должен укладываться в 1/30 с на процессоре даже при замедлении ×4
      expect.soft(r.cpuMs, `${r.spec}: ${r.cpuMs} мс процессора на кадр при ×${CPU_SLOWDOWN}`).toBeLessThan(1000 / FPS_MIN);
      if (mobile) {
        expect.soft(r.calls, `${r.spec}: вызовов отрисовки`).toBeLessThanOrEqual(MOBILE_BUDGET.calls);
        expect.soft(r.triangles, `${r.spec}: треугольников`).toBeLessThanOrEqual(MOBILE_BUDGET.triangles);
      }
    }
    expectNoErrors(log);
  });
});

test.describe('сборка (dist)', () => {
  test.beforeAll(() => {
    if (!existsSync(resolve(DIST, 'mobile.html'))) throw new Error('Нет dist/ — сначала выполните: npm run build');
  });

  test('размер файлов', async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'достаточно проверить один раз');
    const mb = (p) => statSync(resolve(DIST, p)).size / 1024 / 1024;
    const sizes = { index: mb('index.html'), desktop: mb('desktop.html'), mobile: mb('mobile.html') };
    console.log('размеры, МБ:', Object.entries(sizes).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', '));
    // каталог сцен (GEMINI.md §2): все площадки в одном файле — не больше 1,3 МБ на страницу;
    // стартовая страница не тянет за собой 3D-движок
    for (const k of ['desktop', 'mobile']) expect(sizes[k], `${k}.html ${sizes[k].toFixed(2)} МБ (бюджет каталога 1,3)`).toBeLessThanOrEqual(CATALOG_MAX_MB);
    expect(sizes.index, `index.html ${sizes.index.toFixed(2)} МБ`).toBeLessThanOrEqual(0.1);
  });

  test('открывается двойным кликом без интернета', async ({ page, context }, info) => {
    test.skip(!['desktop', 'iphone'].includes(info.project.name), 'одна проверка на версию');
    const file = info.project.use.isMobile ? 'mobile.html' : 'desktop.html';
    await context.setOffline(true);
    // любые запросы наружу (не file://) считаем ошибкой
    const external = [];
    page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
    const log = await openApp(page, pathToFileURL(resolve(DIST, file)).href);
    await applyShot(page, 'hall');
    expect(await page.evaluate(() => window.__fest.stats().calls)).toBeGreaterThan(10);
    // все площадки каталога встроены в тот же файл и открываются без сети
    for (const v of await page.evaluate(() => window.__fest.venues.filter((e) => e.status !== 'soon').map((e) => e.id))) {
      expect(await page.evaluate((id) => window.__fest.loadVenue(id), v), `площадка ${v} открылась`).toBe(true);
      expect(await page.evaluate(() => window.__fest.venue())).toBe(v);
    }
    expect(external, 'запросы в интернет').toEqual([]);
    expectNoErrors(log);
  });
});

// Паритет-харнесс: Большая и Камерная сцены до и после переделки движка.
//
// Зачем: при доработке общего движка (новые площадки, новые возможности) готовые площадки
// должны выдавать ровно то же самое — те же DXF/GLB, то же состояние и ссылки, ту же картинку.
// Эталон снимается с сборки до переделки (например, с master) и дальше не меняется.
//
// Запуск (из каталога app):
//   node scripts/parity.mjs capture [distDir]   — снять эталон; по умолчанию distDir =
//                                                  review/modular/baseline/dist-master,
//                                                  результат — review/modular/baseline/<площадка>/
//   node scripts/parity.mjs compare [distDir]   — сравнить сборку (по умолчанию dist) с эталоном;
//                                                  отчёт — review/modular/parity-report.json и .md,
//                                                  артефакты сравнения — review/modular/compare/<площадка>/;
//                                                  код выхода 1 при любом расхождении.
// Самопроверка: node scripts/parity.mjs compare <distDir эталона> — должно быть 100%.
// Площадки и их сценарии — VENUES ниже (big, chamber).
//
// Что сравнивается (для каждой площадки):
//   а) экспорт (сценарии площадки): DXF плана, разреза, 3D — строки, SHA-256 должен совпасть
//      точно (при расхождении — первые 20 различающихся строк); GLB — SHA-256 байтов (считается в браузере).
//   б) состояние (сценарии × desktop/mobile): (1) тот же сценарий в новой сборке → getState()
//      по ключам heights, fixturesOn, flags, layers, portable, view; (2) ссылка эталона
//      (stage.stateString()) → stage.loadState() на свежей странице → getState()
//      совпадает с тем, что давала старая сборка на той же ссылке (старые ссылки работают).
//      Лишние ключи верхнего уровня (например venue, layout) игнорируются; лишние вложенные — предупреждение.
//   в) снимки: Большая — 22 вида из tests/e2e/shots.spec.js, остальные — набор «снимки площадки» оттуда же;
//      desktop (1920×1080) и iphone (iPhone 13, dpr 1), PNG; попиксельное сравнение в браузере
//      (пиксель отличается, если max |Δканала| > 24), проходит при ≤ 0,5 % отличающихся пикселей;
//      для провалов сохраняется картинка разницы.
//
// Используется только стабильная часть window.__fest: loadVenue, views, setView, flag, light,
// portable, setHeight, select, selectFixture, renderNow, getState, stage.allTo, stage.views, stage.stateString(),
// stage.loadState(), exportPlanDXF, exportSectionDXF, export3DDXF, exportGLB, stage.profile.
// Сборке без loadVenue (до каталога сцен) открывается только Большая сцена — Камерную такой эталон не снимет.
import { chromium, devices } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyShot } from '../tests/e2e/helpers.js';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOD = join(APP, 'review/modular');
const BASE = join(MOD, 'baseline');
const CMP = join(MOD, 'compare');

// те же флаги Chrome, что в playwright.config.js (SwiftShader; FEST_GPU=1 — видеокарта)
const CHROME_ARGS = process.env.FEST_GPU
  ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
  : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

/** Те же 22 снимка Большой сцены, что в tests/e2e/shots.spec.js. */
const SHOTS = [
  'overview', 'hall', 'booth', 'plan', 'planStage', 'section', 'stageToHall', 'upperGallery', 'flyGallery',
  'plan+bp+dims', 'plan+bp+grid', 'planStage+bp+dims', 'section+bp+dims+grid',
  'hall+off', 'hall+off+noduty+house', 'hall+onlyC2', 'overview+low', 'flyGallery+low',
  'hall+pstand', 'overview+nums', 'overview+sel53', 'hall+selSh5',
];
/**
 * Площадки под контролем паритета. Снимки остальных площадок — как в shots.spec.js:
 * все виды + орто с чертежом и размерами + первое орто с сеткой + выключенный свет + номера.
 * Список снимков фиксируется в эталоне (manifest), новые виды площадки сравнение не ломают.
 */
const VENUES = {
  big: {
    shots: async () => SHOTS,
    exports: ['default', 'low'],
    states: ['default', 'low', 'hall+onlyC2', 'plan+bp+dims+grid', 'pfloor6+haze55'],
  },
  chamber: {
    shots: async (page) => page.evaluate(() => {
      const views = window.__fest.views;
      const ortho = Object.entries(window.__fest.stage.views).filter(([, v]) => v.type === 'ortho').map(([k]) => k);
      return [...views, ...ortho.map((k) => `${k}+bp+dims`), ...ortho.slice(0, 1).map((k) => `${k}+bp+grid`), `${views[0]}+off+house`, `${views[0]}+nums`];
    }),
    exports: ['default', 'onlyRow1'],
    states: ['default', 'onlyRow1', 'plan+bp+dims+grid', 'off+house+haze55'],
  },
};
const STATE_KEYS = ['heights', 'fixturesOn', 'flags', 'layers', 'portable', 'view'];
const PROFILES = {
  desktop: { file: 'desktop.html', ctx: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } },
  iphone: { file: 'mobile.html', ctx: (() => { const d = { ...devices['iPhone 13'], deviceScaleFactor: 1 }; delete d.defaultBrowserType; return d; })() },
};
const PIX_THRESHOLD = 24;     // пиксель «другой», если max |Δ| по каналу больше
const PIX_MAX_PCT = 0.5;      // допустимая доля отличающихся пикселей, %
const NOISE = [/GPU stall due to ReadPixels/i, /GL Driver Message/i, /WebGL.*performance/i, /Automatic fallback to software WebGL/i];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const fname = (s) => s.replace(/\+/g, '_');
const ms = (t0) => Date.now() - t0;
const wjson = (p, o) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(o, null, 1)); };
const wfile = (p, d) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, d); };

// ---------------------------------------------------------------------------
//  Браузер и страницы
// ---------------------------------------------------------------------------
let browser;
const consoleErrors = [];

async function newPage(profile) {
  const ctx = await browser.newContext({ ...PROFILES[profile].ctx, acceptDownloads: false });
  return ctx.newPage();
}

/** Открыть страницу приложения (file://), дождаться готовности, при наличии — loadVenue(venue). */
async function openApp(distDir, profile, venue) {
  const page = await newPage(profile);
  const tag = `${venue}/${profile}`;
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.some((r) => r.test(m.text()))) consoleErrors.push(`[${tag}] ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`[${tag}] [pageerror] ${e.message}`));
  await page.goto(pathToFileURL(join(distDir, PROFILES[profile].file)).href);
  await page.waitForFunction(() => window.__fest?.ready, null, { timeout: 180_000 });
  await page.evaluate(async (venue) => {
    if (typeof window.__fest.loadVenue === 'function') await window.__fest.loadVenue(venue);
    else if (venue !== 'big') throw new Error(`в сборке нет loadVenue — площадку ${venue} не открыть`);
  }, venue);
  await page.waitForFunction(() => window.__fest?.ready, null, { timeout: 180_000 });
  // исходные флаги — чтобы сброс между сценариями возвращал и плотность дымки
  await page.evaluate(() => { window.__parityInitFlags = { ...window.__fest.getState().flags }; });
  return page;
}

async function closePage(page) { await page.context().close(); }

/** Применить сценарий (в странице): сброс к исходному состоянию + модификаторы. */
async function applyScenario(page, name) {
  await page.evaluate((name) => {
    const f = window.__fest;
    f.stage.allTo('rest');
    f.light('all', true);
    f.portable('off', 8);
    for (const [k, v] of Object.entries(window.__parityInitFlags)) f.flag(k, v);
    f.select(null);
    f.setView('overview');
    const low = () => { for (const id of ['Sh3', 'Sh5', 'Sh9']) f.setHeight(id, 2); f.setHeight('C2', 3); };
    switch (name) {
      case 'default': break;
      case 'low': low(); f.portable('stand', 8); break;
      case 'hall+onlyC2': f.setView('hall'); f.light('all', false); f.light('C2', true); break;
      case 'onlyRow1': f.light('all', false); f.light('row1', true); break;
      case 'plan+bp+dims+grid': f.setView('plan'); f.flag('blueprint', true); f.flag('dims', true); f.flag('grid', true); break;
      case 'pfloor6+haze55': f.portable('floor', 6); f.flag('hazeDensity', 0.55); break;
      case 'off+house+haze55': f.light('all', false); f.flag('house', true); f.flag('hazeDensity', 0.55); break;
      default: throw new Error(`неизвестный сценарий ${name}`);
    }
    f.renderNow();
  }, name);
}

// ---------------------------------------------------------------------------
//  Снятие данных
// ---------------------------------------------------------------------------
async function grabExports(page, scenario) {
  await applyScenario(page, scenario);
  const r = await page.evaluate(async () => {
    const f = window.__fest;
    const plan = f.exportPlanDXF();
    const section = f.exportSectionDXF();
    const d3 = f.export3DDXF();
    const buf = await f.exportGLB();
    const u8 = new Uint8Array(buf);
    const dig = new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
    const glbHash = [...dig].map((b) => b.toString(16).padStart(2, '0')).join('');
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { plan, section, d3, glbHash, glbB64: btoa(s) };
  });
  const glb = Buffer.from(r.glbB64, 'base64');
  if (sha256(glb) !== r.glbHash) throw new Error('GLB: хеш в браузере не совпал с хешем в Node');
  return {
    files: { plan: r.plan, section: r.section, '3d': r.d3 },
    glb,
    hashes: { plan: sha256(r.plan), section: sha256(r.section), '3d': sha256(r.d3), glb: r.glbHash },
    sizes: { plan: r.plan.length, section: r.section.length, '3d': r.d3.length, glb: glb.length },
  };
}

async function grabState(page, scenario) {
  await applyScenario(page, scenario);
  return page.evaluate(() => ({ v1: window.__fest.stage.stateString(), state: window.__fest.getState() }));
}

/** Свежая страница → loadState(старая ссылка) → getState(). */
async function stateFromLink(distDir, profile, venue, v1) {
  const page = await openApp(distDir, profile, venue);
  const st = await page.evaluate((v1) => {
    const ok = window.__fest.stage.loadState(v1);
    window.__fest.renderNow();
    return { ok, state: window.__fest.getState() };
  }, v1);
  await closePage(page);
  return st;
}

async function grabShot(page, spec, file) {
  await applyShot(page, spec);
  // всплывающие подсказки и подсказка жестов телефона (.mhint гаснет сама через 3 с — гонка по времени) — не в кадр
  const hideOverlays = () => {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    document.querySelectorAll('.mhint').forEach((e) => { e.style.display = 'none'; });
  };
  await page.evaluate(hideOverlays);
  await page.evaluate(() => window.__fest.renderNow());
  await page.waitForTimeout(300);
  await page.evaluate(hideOverlays);
  const png = await page.screenshot({ type: 'png', scale: 'css', animations: 'disabled', caret: 'hide' });
  wfile(file, png);
  return png;
}

/** Снимки площадки; specs — список из эталона (null — составить по VENUES[venue].shots). */
async function captureShots(distDir, outDir, timings, venue, specs = null) {
  const list = {};
  for (const profile of Object.keys(PROFILES)) {
    const t0 = Date.now();
    const page = await openApp(distDir, profile, venue);
    list[profile] = [];
    let n = 0;
    for (const spec of specs?.[profile]?.map((s) => s.spec) || (await VENUES[venue].shots(page))) {
      const file = `${String(++n).padStart(2, '0')}-${fname(spec)}.png`;
      await grabShot(page, spec, join(outDir, profile, file));
      list[profile].push({ spec, file });
    }
    await closePage(page);
    timings[`shots-${venue}-${profile}`] = ms(t0);
  }
  return list;
}

// ---------------------------------------------------------------------------
//  capture
// ---------------------------------------------------------------------------
async function capture(distDir) {
  const timings = {};
  // эталон прежнего формата (только Большая сцена, в корне baseline) — убрать
  for (const d of ['exports', 'state', 'shots']) rmSync(join(BASE, d), { recursive: true, force: true });
  const manifest = { created: new Date().toISOString(), distDir, venues: {} };
  for (const venue of Object.keys(VENUES)) manifest.venues[venue] = await captureVenue(distDir, venue, timings);
  manifest.timings = timings;
  manifest.consoleErrors = consoleErrors;
  wjson(join(BASE, 'manifest.json'), manifest);
  return manifest;
}

async function captureVenue(distDir, venue, timings) {
  const cfg = VENUES[venue];
  const VB = join(BASE, venue);
  rmSync(VB, { recursive: true, force: true });
  const m = { exports: {}, state: {}, shots: {} };

  // а) экспорт — desktop
  let t0 = Date.now();
  let page = await openApp(distDir, 'desktop', venue);
  for (const sc of cfg.exports) {
    const e = await grabExports(page, sc);
    for (const [k, txt] of Object.entries(e.files)) wfile(join(VB, 'exports', `${sc}-${k}.dxf`), txt);
    wfile(join(VB, 'exports', `${sc}.glb`), e.glb);
    m.exports[sc] = { hashes: e.hashes, sizes: e.sizes };
  }
  timings[`exports-${venue}`] = ms(t0);

  // б) состояние — оба профиля (у мобильного другие исходные флаги)
  t0 = Date.now();
  for (const profile of Object.keys(PROFILES)) {
    if (profile !== 'desktop') page = await openApp(distDir, profile, venue);
    for (const sc of cfg.states) {
      const s = await grabState(page, sc);
      const fromLink = await stateFromLink(distDir, profile, venue, s.v1);
      const rec = { profile, scenario: sc, v1: s.v1, state: s.state, stateFromLink: fromLink.state, loadOk: fromLink.ok,
        linkRoundTripExact: diffState(s.state, fromLink.state).errors.length === 0 };
      wjson(join(VB, 'state', `${profile}-${fname(sc)}.json`), rec);
      m.state[`${profile}/${sc}`] = { file: `${profile}-${fname(sc)}.json`, linkRoundTripExact: rec.linkRoundTripExact };
    }
    await closePage(page);
  }
  timings[`state-${venue}`] = ms(t0);

  // в) снимки
  m.shots = await captureShots(distDir, join(VB, 'shots'), timings, venue);
  return m;
}

// ---------------------------------------------------------------------------
//  Сравнение
// ---------------------------------------------------------------------------
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function deepDiff(a, b, path, out) {
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-9) out.errors.push(`${path}: ${a} → ${b}`); return; }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) { out.errors.push(`${path}: массив ${JSON.stringify(a)?.slice(0, 80)} → ${JSON.stringify(b)?.slice(0, 80)}`); return; }
    a.forEach((v, i) => deepDiff(v, b[i], `${path}[${i}]`, out));
    return;
  }
  if (isObj(a) && isObj(b)) {
    for (const k of Object.keys(a)) {
      if (!(k in b)) out.errors.push(`${path}.${k}: отсутствует в новой сборке`);
      else deepDiff(a[k], b[k], `${path}.${k}`, out);
    }
    for (const k of Object.keys(b)) if (!(k in a)) out.warnings.push(`${path}.${k}: новый ключ (${JSON.stringify(b[k])})`);
    return;
  }
  if (a !== b) out.errors.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
}
/** Сравнение состояний по ключам STATE_KEYS (лишние ключи верхнего уровня игнорируются). */
function diffState(a, b) {
  const out = { errors: [], warnings: [] };
  for (const k of STATE_KEYS) {
    if (!b || !(k in b)) out.errors.push(`${k}: отсутствует`);
    else deepDiff(a[k], b[k], k, out);
  }
  return out;
}

function dxfDiff(a, b) {
  const la = a.split(/\r?\n/), lb = b.split(/\r?\n/);
  const lines = [];
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n && lines.length < 20; i++) if (la[i] !== lb[i]) lines.push(`L${i + 1}: ${JSON.stringify(la[i] ?? '∅')} → ${JSON.stringify(lb[i] ?? '∅')}`);
  return { linesBase: la.length, linesNew: lb.length, firstDiffs: lines };
}

/** Попиксельное сравнение двух PNG в браузере. */
async function pixelDiff(diffPage, pngA, pngB) {
  return diffPage.evaluate(async ({ a, b, thr }) => {
    const load = (b64) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `data:image/png;base64,${b64}`; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { sizeMismatch: `${ia.width}×${ia.height} → ${ib.width}×${ib.height}`, pct: 100, maxDiff: 255 };
    const w = ia.width, h = ia.height;
    const data = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const da = data(ia), db = data(ib);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const out = g.createImageData(w, h);
    let bad = 0, maxDiff = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]), Math.abs(da[i + 3] - db[i + 3]));
      if (d > maxDiff) maxDiff = d;
      const y = (0.2126 * da[i] + 0.7152 * da[i + 1] + 0.0722 * da[i + 2]) * 0.35;
      if (d > thr) { bad++; out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 0; } else { out.data[i] = out.data[i + 1] = out.data[i + 2] = y; }
      out.data[i + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    const pct = (bad * 100) / (w * h);
    return { pct, bad, maxDiff, diffPng: bad ? c.toDataURL('image/png').split(',')[1] : null };
  }, { a: pngA.toString('base64'), b: pngB.toString('base64'), thr: PIX_THRESHOLD });
}

async function compare(distDir) {
  const timings = {};
  const manifest = JSON.parse(readFileSync(join(BASE, 'manifest.json'), 'utf8'));
  if (!manifest.venues) throw new Error('эталон прежнего формата (только Большая сцена) — переснимите: node scripts/parity.mjs capture <dist>');
  rmSync(CMP, { recursive: true, force: true });
  const report = { created: new Date().toISOString(), distDir, baseline: manifest.created, exports: [], state: [], shots: [], timings };
  const diffPage = await newPage('desktop');
  await diffPage.setContent('<!doctype html><title>diff</title>');
  for (const [venue, vm] of Object.entries(manifest.venues)) await compareVenue(distDir, venue, vm, report, diffPage);
  await closePage(diffPage);

  report.consoleErrors = consoleErrors;
  const all = [...report.exports, ...report.state, ...report.shots];
  report.summary = {
    exports: `${report.exports.filter((r) => r.ok).length}/${report.exports.length}`,
    state: `${report.state.filter((r) => r.ok).length}/${report.state.length}`,
    shots: `${report.shots.filter((r) => r.ok).length}/${report.shots.length}`,
    pass: all.every((r) => r.ok),
  };
  wjson(join(MOD, 'parity-report.json'), report);
  writeFileSync(join(MOD, 'parity-report.md'), toMarkdown(report));
  return report;
}

async function compareVenue(distDir, venue, vm, report, diffPage) {
  const { timings } = report;
  const VB = join(BASE, venue), VC = join(CMP, venue);
  // а) экспорт
  let t0 = Date.now();
  let page = await openApp(distDir, 'desktop', venue);
  for (const sc of Object.keys(vm.exports)) {
    const e = await grabExports(page, sc);
    for (const k of ['plan', 'section', '3d']) {
      wfile(join(VC, 'exports', `${sc}-${k}.dxf`), e.files[k]);
      const want = vm.exports[sc].hashes[k];
      const row = { venue, scenario: sc, kind: `${k} DXF`, base: want, got: e.hashes[k], ok: want === e.hashes[k] };
      if (!row.ok) row.diff = dxfDiff(readFileSync(join(VB, 'exports', `${sc}-${k}.dxf`), 'utf8'), e.files[k]);
      report.exports.push(row);
    }
    wfile(join(VC, 'exports', `${sc}.glb`), e.glb);
    const want = vm.exports[sc].hashes.glb;
    report.exports.push({ venue, scenario: sc, kind: 'GLB', base: want, got: e.hashes.glb, ok: want === e.hashes.glb,
      sizeBase: vm.exports[sc].sizes.glb, sizeNew: e.sizes.glb });
  }
  timings[`exports-${venue}`] = ms(t0);

  // б) состояние
  t0 = Date.now();
  for (const profile of Object.keys(PROFILES)) {
    if (profile !== 'desktop') page = await openApp(distDir, profile, venue);
    const scenarios = Object.keys(vm.state).filter((k) => k.startsWith(`${profile}/`)).map((k) => k.slice(profile.length + 1));
    for (const sc of scenarios) {
      const rec = JSON.parse(readFileSync(join(VB, 'state', `${profile}-${fname(sc)}.json`), 'utf8'));
      const s = await grabState(page, sc);
      const live = diffState(rec.state, s.state);
      const link = await stateFromLink(distDir, profile, venue, rec.v1);
      const fromLink = diffState(rec.stateFromLink, link.state);
      if (!link.ok) fromLink.errors.unshift('loadState вернул false');
      report.state.push({ venue, profile, scenario: sc, check: 'scenario', ok: !live.errors.length, errors: live.errors.slice(0, 20), warnings: live.warnings.slice(0, 20) });
      report.state.push({ venue, profile, scenario: sc, check: 'link', ok: !fromLink.errors.length, errors: fromLink.errors.slice(0, 20), warnings: fromLink.warnings.slice(0, 20) });
    }
    await closePage(page);
  }
  timings[`state-${venue}`] = ms(t0);

  // в) снимки — тот же список, что в эталоне
  const shots = await captureShots(distDir, join(VC, 'shots'), timings, venue, vm.shots);
  for (const profile of Object.keys(PROFILES)) {
    for (const { spec, file } of shots[profile]) {
      const basePath = join(VB, 'shots', profile, file);
      if (!existsSync(basePath)) { report.shots.push({ venue, profile, spec, file, ok: false, error: 'нет эталона' }); continue; }
      const d = await pixelDiff(diffPage, readFileSync(basePath), readFileSync(join(VC, 'shots', profile, file)));
      const ok = !d.sizeMismatch && d.pct <= PIX_MAX_PCT;
      if (!ok && d.diffPng) wfile(join(VC, 'diff', profile, file), Buffer.from(d.diffPng, 'base64'));
      report.shots.push({ venue, profile, spec, file, ok, pct: +d.pct.toFixed(4), maxDiff: d.maxDiff, ...(d.sizeMismatch ? { sizeMismatch: d.sizeMismatch } : {}) });
    }
  }
}

function toMarkdown(r) {
  const L = [];
  L.push(`# Паритет: ${r.summary.pass ? '✅ ПРОЙДЕН' : '❌ РАСХОЖДЕНИЯ'}`, '');
  L.push(`Сборка: \`${r.distDir}\`  ·  эталон от ${r.baseline}  ·  отчёт ${r.created}`, '');
  L.push(`Экспорт ${r.summary.exports} · состояние ${r.summary.state} · снимки ${r.summary.shots}`, '');
  L.push('## Экспорт', '', '| Площадка | Сценарий | Файл | Итог | SHA-256 эталона | SHA-256 новой |', '|---|---|---|---|---|---|');
  for (const e of r.exports) L.push(`| ${e.venue} | ${e.scenario} | ${e.kind} | ${e.ok ? '✅' : '❌'} | \`${e.base.slice(0, 16)}…\` | \`${e.got.slice(0, 16)}…\` |`);
  for (const e of r.exports.filter((x) => x.diff)) {
    L.push('', `### ${e.venue} ${e.scenario} ${e.kind}: строк ${e.diff.linesBase} → ${e.diff.linesNew}`, '', '```');
    L.push(...e.diff.firstDiffs, '```');
  }
  L.push('', '## Состояние', '', '| Площадка | Профиль | Сценарий | Проверка | Итог | Ошибки / предупреждения |', '|---|---|---|---|---|---|');
  for (const s of r.state) L.push(`| ${s.venue} | ${s.profile} | ${s.scenario} | ${s.check} | ${s.ok ? '✅' : '❌'} | ${[...s.errors, ...s.warnings.map((w) => `⚠ ${w}`)].slice(0, 5).join('<br>').replace(/\|/g, '\\|')} |`);
  L.push('', `## Снимки (порог: Δ > ${PIX_THRESHOLD}, ≤ ${PIX_MAX_PCT} % пикселей)`, '', '| Площадка | Профиль | Снимок | Итог | Отличается, % | max Δ |', '|---|---|---|---|---|---|');
  for (const s of r.shots) L.push(`| ${s.venue} | ${s.profile} | ${s.spec} | ${s.ok ? '✅' : '❌'} | ${s.pct ?? '—'} | ${s.maxDiff ?? s.error ?? ''}${s.sizeMismatch ? ` (размер ${s.sizeMismatch})` : ''} |`);
  L.push('', '## Время, мс', '', ...Object.entries(r.timings).map(([k, v]) => `- ${k}: ${v}`));
  if (r.consoleErrors.length) L.push('', '## Ошибки консоли', '', ...r.consoleErrors.slice(0, 30).map((e) => `- ${e}`));
  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
//  main
// ---------------------------------------------------------------------------
const [mode, distArg] = process.argv.slice(2);
if (!['capture', 'compare'].includes(mode)) {
  console.error('Использование: node scripts/parity.mjs capture|compare [distDir]');
  process.exit(2);
}
const distDir = resolve(APP, distArg || (mode === 'capture' ? 'review/modular/baseline/dist-master' : 'dist'));
for (const f of ['desktop.html', 'mobile.html']) if (!existsSync(join(distDir, f))) { console.error(`нет ${join(distDir, f)}`); process.exit(2); }

const T0 = Date.now();
browser = await chromium.launch({ channel: 'chrome', args: CHROME_ARGS });
let code = 0;
try {
  if (mode === 'capture') {
    const m = await capture(distDir);
    console.log('Эталон снят:', BASE);
    for (const [venue, vm] of Object.entries(m.venues)) {
      for (const [sc, e] of Object.entries(vm.exports)) for (const [k, h] of Object.entries(e.hashes)) console.log(`  ${venue.padEnd(8)} ${sc.padEnd(9)} ${k.padEnd(8)} ${h}  (${e.sizes[k]} B)`);
      console.log(`  ${venue}: состояний ${Object.keys(vm.state).length}, снимков ${Object.values(vm.shots).flat().length}`);
    }
    console.log('  ошибки консоли:', m.consoleErrors.length);
  } else {
    const r = await compare(distDir);
    console.log(`Паритет: ${r.summary.pass ? 'ПРОЙДЕН' : 'РАСХОЖДЕНИЯ'}  экспорт ${r.summary.exports}, состояние ${r.summary.state}, снимки ${r.summary.shots}`);
    for (const s of r.shots.filter((x) => !x.ok)) console.log(`  ✗ снимок ${s.venue}/${s.profile}/${s.spec}: ${s.pct}% (max Δ ${s.maxDiff})`);
    for (const e of r.exports.filter((x) => !x.ok)) console.log(`  ✗ экспорт ${e.venue} ${e.scenario} ${e.kind}`);
    for (const s of r.state.filter((x) => !x.ok)) console.log(`  ✗ состояние ${s.venue}/${s.profile}/${s.scenario}/${s.check}: ${s.errors[0]}`);
    if (r.consoleErrors.length) console.log(`  ✗ ошибки консоли: ${r.consoleErrors.length} (см. отчёт)`);
    console.log('Отчёт:', join(MOD, 'parity-report.md'));
    if (!r.summary.pass) code = 1;
  }
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  await browser.close();
  console.log(`Время: ${((Date.now() - T0) / 1000).toFixed(1)} с`);
}
process.exit(code);

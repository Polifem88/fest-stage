import { chromium } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';

const outDir = 'review/r2/model/shots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
});

const ctx = await browser.newContext({
  viewport: { width: 1280, height: 960 },
  deviceScaleFactor: 1
});

const page = await ctx.newPage();
await page.goto('http://localhost:5173/desktop.html');
await page.waitForFunction(() => window.__fest?.ready, null, { timeout: 30000 });
console.log('Fest app loaded for blueprint tests.');

// 1. Проверка экспликации и данных stage.fixtures.list
const fixtureExplicationCheck = await page.evaluate(() => {
  const f = window.__fest;
  const list = f.stage.fixtures.list;
  const countsByType = {};
  for (const item of list) {
    if (!item.hidden) {
      countsByType[item.type] = (countsByType[item.type] || 0) + 1;
    }
  }
  const totalFixtures = Object.values(countsByType).reduce((a, b) => a + b, 0);

  // Проверим, что генерирует SheetOverlay
  const sheet = f.stage.sheet;
  
  return {
    totalListCount: list.length,
    visibleCount: totalFixtures,
    countsByType
  };
});

console.log('--- СВЕРКА ЭКСПЛИКАЦИИ С ДАННЫМИ СВЕТА ---');
console.log(`Всего приборов в list: ${fixtureExplicationCheck.totalListCount}`);
console.log(`Видимых приборов: ${fixtureExplicationCheck.visibleCount}`);
console.log('По типам:', JSON.stringify(fixtureExplicationCheck.countsByType, null, 2));

// 2. Тест экспорта PNG для PLAN
console.log('\n--- ТЕСТ ЭКСПОРТА ПЛАНА В PNG ЧЕРЕЗ КНОПКУ «📷 PNG» ---');
await page.evaluate(() => {
  const f = window.__fest;
  f.setView('plan');
  f.flag('blueprint', true);
  f.flag('dims', true);
  f.flag('grid', true);
  f.flag('labels', true);
  f.flag('fixtureLabels', true);
  f.renderNow();
});
await page.waitForTimeout(500);

const downloadPlanPromise = page.waitForEvent('download');
await page.locator('button:has-text("📷 PNG")').click();
const downloadPlan = await downloadPlanPromise;
const planPngPath = `${outDir}/export_plan_downloaded.png`;
await downloadPlan.saveAs(planPngPath);
console.log(`План успешно сохранен: ${planPngPath}, размер: ${statSync(planPngPath).size} байт`);

// 3. Тест точности масштабной линейки на плане
const scaleCheckPlan = await page.evaluate(() => {
  const f = window.__fest;
  const cam = f.stage.camera;
  const el = f.stage.renderer.domElement;
  const w = el.clientWidth;
  const h = el.clientHeight;
  const pxPerM_formula = (h * cam.zoom) / (cam.top - cam.bottom);

  // Замеряем портал: 12.5 м от x = -6.25 до x = 6.25
  const pLeft = f.project([-6.25, 0, 0]);
  const pRight = f.project([6.25, 0, 0]);
  const portalPx = Math.abs(pRight.x - pLeft.x);
  const measuredPxPerM_portal = portalPx / 12.5;

  // Замеряем сетку: 2 м от x = 0 до x = 2
  const g0 = f.project([0, 0, 0]);
  const g2 = f.project([2, 0, 0]);
  const gridPx = Math.abs(g2.x - g0.x);
  const measuredPxPerM_grid = gridPx / 2.0;

  // Замеряем глубину сцены: 10 м по глубине d
  const d0 = f.project([0, 0, 0]);
  const d10 = f.project([0, 0, 10]);
  const depthPx = Math.abs(d10.y - d0.y);
  const measuredPxPerM_depth = depthPx / 10.0;

  // Параметры линейки
  const steps = [1, 2, 5, 10, 20];
  const len = steps.find((s) => s * pxPerM_formula >= Math.min(160, w * 0.3)) || 20;
  const scaleBarPx = len * pxPerM_formula;

  return {
    w, h,
    zoom: cam.zoom,
    camBounds: { top: cam.top, bottom: cam.bottom, left: cam.left, right: cam.right },
    pxPerM_formula,
    measuredPxPerM_portal,
    measuredPxPerM_grid,
    measuredPxPerM_depth,
    scaleBar: { lenM: len, px: scaleBarPx }
  };
});

console.log('--- ЗАМЕРЫ МАСШТАБА (ПЛАН) ---');
console.log(`Формула (pxPerM): ${scaleCheckPlan.pxPerM_formula.toFixed(3)} px/м`);
console.log(`По ширине портала (12.5 м): ${scaleCheckPlan.measuredPxPerM_portal.toFixed(3)} px/м (разница: ${(scaleCheckPlan.measuredPxPerM_portal - scaleCheckPlan.pxPerM_formula).toFixed(4)} px)`);
console.log(`По шагу сетки (2.0 м): ${scaleCheckPlan.measuredPxPerM_grid.toFixed(3)} px/м (разница: ${(scaleCheckPlan.measuredPxPerM_grid - scaleCheckPlan.pxPerM_formula).toFixed(4)} px)`);
console.log(`По глубине d (10.0 м): ${scaleCheckPlan.measuredPxPerM_depth.toFixed(3)} px/м (разница: ${(scaleCheckPlan.measuredPxPerM_depth - scaleCheckPlan.pxPerM_formula).toFixed(4)} px)`);
console.log(`Масштабная линейка: длина ${scaleCheckPlan.scaleBar.lenM} м = ${scaleCheckPlan.scaleBar.px.toFixed(1)} px (1 м = ${(scaleCheckPlan.scaleBar.px / scaleCheckPlan.scaleBar.lenM).toFixed(3)} px)`);

// 4. Тест экспорта PNG для SECTION
console.log('\n--- ТЕСТ ЭКСПОРТА РАЗРЕЗА В PNG ЧЕРЕЗ КНОПКУ «📷 PNG» ---');
await page.evaluate(() => {
  const f = window.__fest;
  f.setView('section');
  f.flag('blueprint', true);
  f.flag('dims', true);
  f.flag('grid', true);
  f.flag('labels', true);
  f.flag('fixtureLabels', false);
  f.renderNow();
});
await page.waitForTimeout(500);

const downloadSectionPromise = page.waitForEvent('download');
await page.locator('button:has-text("📷 PNG")').click();
const downloadSection = await downloadSectionPromise;
const sectionPngPath = `${outDir}/export_section_downloaded.png`;
await downloadSection.saveAs(sectionPngPath);
console.log(`Разрез успешно сохранен: ${sectionPngPath}, размер: ${statSync(sectionPngPath).size} байт`);

// 5. Тест точности масштабной линейки на разрезе
const scaleCheckSection = await page.evaluate(() => {
  const f = window.__fest;
  const cam = f.stage.camera;
  const el = f.stage.renderer.domElement;
  const w = el.clientWidth;
  const h = el.clientHeight;
  const pxPerM_formula = (h * cam.zoom) / (cam.top - cam.bottom);

  // Высота портала 5.15 м: от y = 0 до y = 5.15 при d = 0
  const y0 = f.project([0, 0, 0]);
  const yPortal = f.project([0, 5.15, 0]);
  const portalH_px = Math.abs(yPortal.y - y0.y);
  const measuredPxPerM_height = portalH_px / 5.15;

  return {
    pxPerM_formula,
    measuredPxPerM_height
  };
});
console.log('--- ЗАМЕРЫ МАСШТАБА (РАЗРЕЗ) ---');
console.log(`Формула (pxPerM): ${scaleCheckSection.pxPerM_formula.toFixed(3)} px/м`);
console.log(`По высоте портала (5.15 м): ${scaleCheckSection.measuredPxPerM_height.toFixed(3)} px/м`);

// 6. Проверка видимости подписей канатов в разных видах
console.log('\n--- ПРОВЕРКА ПОДПИСЕЙ КАНАТОВ (ВИДИМОСТЬ В РАЗНЫХ ВИДАХ) ---');
const ropeVisibilityCheck = await page.evaluate(() => {
  const f = window.__fest;
  const rig = f.stage.rigging;
  const results = {};

  // Функция для подсчета видимых спрайтов канатов
  const checkRopes = (viewName) => {
    f.setView(viewName);
    f.renderNow();
    let totalRopes = 0;
    let visibleRopes = 0;
    rig.root.traverse((obj) => {
      if (obj.userData?.kind === 'rope' || obj.name?.includes('rope') || obj.userData?.rigId) {
        totalRopes++;
        if (obj.visible) visibleRopes++;
      }
    });
    return { totalRopes, visibleRopes };
  };

  results['overview'] = checkRopes('overview');
  results['hall'] = checkRopes('hall');
  results['booth'] = checkRopes('booth');
  results['flyGallery'] = checkRopes('flyGallery');

  // Выбираем штанкет Sh5 в виде hall
  f.setView('hall');
  f.select({ kind: 'rig', id: 'Sh5' });
  f.renderNow();
  let selSh5RopeVisible = 0;
  rig.root.traverse((obj) => {
    if (obj.userData?.rigId === 'Sh5' && obj.visible) selSh5RopeVisible++;
  });
  results['hall_selected_Sh5'] = { selSh5RopeVisible };

  return results;
});

console.log('Видимость подписей канатов:', JSON.stringify(ropeVisibilityCheck, null, 2));

await browser.close();

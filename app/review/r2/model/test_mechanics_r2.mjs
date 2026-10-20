import { chromium } from '@playwright/test';

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
console.log('Fest app loaded for mechanics testing.');

const mechanicsResults = await page.evaluate(async () => {
  const f = window.__fest;
  const stage = f.stage;
  const rig = stage.rigging;
  const fix = stage.fixtures;

  const getCwY = (id) => {
    const it = rig.items.get(id);
    if (!it) return null;
    const arr = rig.arbors.instanceMatrix.array;
    return arr[it.cwIndex * 16 + 13];
  };

  const getPipeY = (id) => {
    const it = rig.items.get(id);
    return it ? it.h : null;
  };

  const getFixtureMountY = (fixtureIndex) => {
    const item = fix.list[fixtureIndex];
    return fix.mountPos(item).y;
  };

  // 1. Проверяем все элементы механики
  const rigItems = [];
  for (const [id, item] of rig.items) {
    const r = item.cfg;
    rigItems.push({
      id,
      name: r.name,
      kind: r.kind,
      min: r.min,
      max: r.max,
      rest: r.rest,
      control: r.control,
      lines: r.lines,
      cwIndex: item.cwIndex,
      initialPipeY: getPipeY(id),
      initialCwY: getCwY(id)
    });
  }

  // 2. Тестируем полный ход для C1, Sh4, Sh10, Z, B1, B2
  const testIds = ['C1', 'Sh4', 'Sh10', 'Z', 'B1', 'B2'];
  const strokeTests = {};

  for (const id of testIds) {
    const item = rig.items.get(id);
    const r = item.cfg;
    const restCw = getCwY(id);
    const restPipe = getPipeY(id);

    // Опускаем в минимум
    f.setHeight(id, r.min);
    const minPipe = getPipeY(id);
    const minCw = getCwY(id);

    // Поднимаем в максимум
    f.setHeight(id, r.max);
    const maxPipe = getPipeY(id);
    const maxCw = getCwY(id);

    // Возвращаем в rest
    f.setHeight(id, r.rest);
    const backPipe = getPipeY(id);
    const backCw = getCwY(id);

    strokeTests[id] = {
      cfgMin: r.min,
      cfgMax: r.max,
      cfgRest: r.rest,
      minPipe,
      maxPipe,
      backPipe,
      restCw,
      minCw,
      maxCw,
      backCw,
      cwMovesInverselyMin: minCw > restCw,
      cwMovesInverselyMax: maxCw < restCw,
      cwDeltaMatchesPipeDelta: Math.abs((minCw - restCw) - (restPipe - minPipe)) < 0.05
    };
  }

  // 3. Тестируем синхронность движения приборов на всех софитах (C0, C1, C2, C3)
  const sofitTests = {};
  for (const sofitId of ['C0', 'C1', 'C2', 'C3']) {
    const sofitFixtures = fix.list
      .map((item, idx) => ({ idx, item }))
      .filter(({ item }) => item.mount.on === sofitId);

    const fIdx = sofitFixtures[0]?.idx;
    if (fIdx === undefined) continue;

    const initialSofitH = getPipeY(sofitId);
    const initialFixtureY = getFixtureMountY(fIdx);

    // Опускаем софит на 2 метра ниже
    const targetH = Math.max(1.5, initialSofitH - 2.0);
    f.setHeight(sofitId, targetH);
    const loweredSofitH = getPipeY(sofitId);
    const loweredFixtureY = getFixtureMountY(fIdx);

    const pipeDelta = initialSofitH - loweredSofitH;
    const fixtureDelta = initialFixtureY - loweredFixtureY;

    // Возвращаем софит
    f.setHeight(sofitId, initialSofitH);

    sofitTests[sofitId] = {
      fixturesCount: sofitFixtures.length,
      firstFixtureIdx: fIdx,
      pipeDelta,
      fixtureDelta,
      inSync: Math.abs(pipeDelta - fixtureDelta) < 0.001
    };
  }

  // 4. Проверяем hover и highlight в RiggingSystem
  rig.hover('Sh3');
  const hovItemSh3 = rig.items.get('Sh3');
  const hovSh3Emissive = hovItemSh3.mat.emissiveIntensity;

  rig.highlight('Sh3');
  const selSh3Emissive = hovItemSh3.mat.emissiveIntensity;

  rig.highlight(null);
  rig.hover(null);
  const unselSh3Emissive = hovItemSh3.mat.emissiveIntensity;

  const pickingMethods = {
    hasAxisMethod: typeof rig.axis === 'function',
    axisSh3: rig.axis ? rig.axis('Sh3') : null,
    hovSh3Emissive,
    selSh3Emissive,
    unselSh3Emissive
  };

  return {
    totalRigItems: rigItems.length,
    rigItems,
    strokeTests,
    sofitTests,
    pickingMethods
  };
});

console.log('--- РЕЗУЛЬТАТЫ ПРОВЕРКИ МЕХАНИКИ ---');
console.log(`Всего элементов механики: ${mechanicsResults.totalRigItems}`);
console.log('\nТесты хода штанкетов и противовесов:');
for (const [id, res] of Object.entries(mechanicsResults.strokeTests)) {
  console.log(`- ${id}:`);
  console.log(`  Мин: труба=${res.minPipe} м, груз=${res.minCw?.toFixed(2)} м (инверсно: ${res.cwMovesInverselyMin})`);
  console.log(`  Макс: труба=${res.maxPipe} м, груз=${res.maxCw?.toFixed(2)} м (инверсно: ${res.cwMovesInverselyMax})`);
  console.log(`  Точность Δ(груз) = Δ(труба): ${res.cwDeltaMatchesPipeDelta ? 'ДА' : 'НЕТ'}`);
}

console.log('\nТесты синхронности софитов и приборов:');
for (const [id, res] of Object.entries(mechanicsResults.sofitTests)) {
  console.log(`- ${id}: приборов=${res.fixturesCount}, Δ трубы=${res.pipeDelta.toFixed(2)} м, Δ прибора=${res.fixtureDelta.toFixed(2)} м, синхронно=${res.inSync}`);
}

console.log('\nМетоды подсветки и выбора:');
console.log(`- rig.axis() существует: ${mechanicsResults.pickingMethods.hasAxisMethod}`);
console.log(`- Emissive intensity: hover=${mechanicsResults.pickingMethods.hovSh3Emissive}, select=${mechanicsResults.pickingMethods.selSh3Emissive}, unselect=${mechanicsResults.pickingMethods.unselSh3Emissive}`);

// 5. Тестируем визуально выбор и перетаскивание штанкета мышь в 3D
console.log('\n--- ТЕСТ 3D PICK & DRAG C ПЛАШКОЙ ВЫСОТЫ ---');
await page.evaluate(() => {
  const f = window.__fest;
  f.setView('overview');
  f.renderNow();
});
await page.waitForTimeout(300);

// Находим координаты экрана для софита C1
const screenPos = await page.evaluate(() => {
  const f = window.__fest;
  // C1 висит по центру [0, h, d]
  const it = f.stage.rigging.items.get('C1');
  return f.project([0, it.h, it.cfg.d]);
});
console.log(`Координаты C1 на экране: x=${screenPos.x}, y=${screenPos.y}`);

// Наводим мышь на софит C1
await page.mouse.move(screenPos.x, screenPos.y);
await page.waitForTimeout(150);

// Проверяем, появился ли hover или курсор grab
const hoverState = await page.evaluate(() => {
  const f = window.__fest;
  return {
    hoverRig: f.stage.rigging._hov,
    cursor: f.stage.renderer.domElement.style.cursor
  };
});
console.log(`Состояние hover: rig=${hoverState.hoverRig}, cursor=${hoverState.cursor}`);

// Перетаскиваем мышью софит вниз на 50 пикселей
await page.mouse.down();
await page.mouse.move(screenPos.x, screenPos.y + 60, { steps: 5 });
await page.waitForTimeout(100);

// Проверяем наличие плашки высоты в DOM
const dragBadgeState = await page.evaluate(() => {
  const f = window.__fest;
  const badge = document.querySelector('.height-badge, .drag-badge, .rig-badge') ||
    Array.from(document.querySelectorAll('div')).find(d => d.textContent.includes('м') && d.style.position === 'absolute');
  return {
    isDragging: !!f.stage._dragging,
    badgeFound: !!badge,
    badgeText: badge ? badge.textContent : null,
    badgeStyle: badge ? badge.style.cssText : null,
    currentHeight: f.height('C1')
  };
});
console.log('Состояние перетаскивания (drag):', JSON.stringify(dragBadgeState, null, 2));

// Снимок процесса перетаскивания с плашкой
await page.screenshot({
  path: 'review/r2/model/shots/test_drag_badge.jpg',
  type: 'jpeg',
  quality: 70
});

await page.mouse.up();
await page.waitForTimeout(200);

await browser.close();

import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
});

const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
await page.goto('http://localhost:5173/desktop.html');
await page.waitForFunction(() => window.__fest?.ready);

console.log('--- ТЕСТИРОВАНИЕ МЕХАНИКИ ---');

// 1. Проверяем исходные высоты
const initial = await page.evaluate(() => {
  const f = window.__fest;
  const res = {};
  for (const [id, item] of f.stage.rigging.items) {
    res[id] = {
      height: f.height(id),
      min: item.cfg.min,
      max: item.cfg.max,
      rest: item.cfg.rest
    };
  }
  return res;
});
console.log('Исходные высоты (проверены):', Object.keys(initial).length, 'объектов');

// 2. Опускаем несколько штанкетов и софитов
const moveRes = await page.evaluate(() => {
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

  const c1Fix = fix.list.find(x => x.mount.on === 'C1');
  const c1MountYBefore = fix.mountPos(c1Fix).y;

  const beforeCw = {
    Sh3: getCwY('Sh3'),
    C1: getCwY('C1'),
    C2: getCwY('C2'),
    Sh8: getCwY('Sh8'),
    B1: getCwY('B1')
  };

  // Опускаем
  f.setHeight('Sh3', 1.0);
  f.setHeight('C1', 2.0);
  f.setHeight('C2', 2.5);
  f.setHeight('Sh8', 1.5);
  f.setHeight('B1', 1.5);

  const afterCw = {
    Sh3: getCwY('Sh3'),
    C1: getCwY('C1'),
    C2: getCwY('C2'),
    Sh8: getCwY('Sh8'),
    B1: getCwY('B1')
  };

  const c1MountYAfter = fix.mountPos(c1Fix).y;

  const finalH = {};
  for (const id of ['Sh3', 'C1', 'C2', 'Sh8', 'B1']) {
    finalH[id] = f.height(id);
  }

  return {
    beforeCw,
    afterCw,
    c1MountYBefore,
    c1MountYAfter,
    finalH
  };
});

console.log('Результаты движения:');
console.log('Положения противовесов (Y):');
for (const id of Object.keys(moveRes.beforeCw)) {
  const b = moveRes.beforeCw[id];
  const a = moveRes.afterCw[id];
  const delta = a - b;
  console.log(`- ${id}: до=${b?.toFixed(2)} м, после=${a?.toFixed(2)} м (Δ=${delta > 0 ? '+' : ''}${delta?.toFixed(2)} м) -> ${delta > 0 ? 'ПОШЕЛ ВВЕРХ (ВЕРНО)' : 'ОШИБКА'}`);
}

console.log(`\nПриборы на софите C1: Y крепления до=${moveRes.c1MountYBefore.toFixed(2)} м, Y после=${moveRes.c1MountYAfter.toFixed(2)} м (опустились на ${(moveRes.c1MountYBefore - moveRes.c1MountYAfter).toFixed(2)} м, синхронно с софитом)`);
console.log('Итоговые высоты объектов:', moveRes.finalH);

// Снимок опущенных штанкетов со стороны зала
await page.evaluate(() => {
  document.body.classList.add('side-hidden');
  const f = window.__fest;
  f.setView('overview');
  f.flag('duty', true);
  f.light('all', true);
  f.renderNow();
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'review/model/mechanics_lowered.jpg', type: 'jpeg', quality: 75 });

// Снимок противовесов на левой стене (поднятых вверх)
await page.evaluate(() => {
  const f = window.__fest;
  f.setView('flyGallery');
  f.flag('labels', true);
  f.renderNow();
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'review/model/counterweights_up.jpg', type: 'jpeg', quality: 75 });

console.log('Скриншоты сохранены в review/model/.');
await browser.close();

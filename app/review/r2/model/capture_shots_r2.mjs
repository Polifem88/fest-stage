import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const outDir = 'review/r2/model/shots';
mkdirSync(outDir, { recursive: true });

const shots = [
  {
    name: '01-Большая сцена вид на сцену',
    pos: [0, 1.3, -11.0],
    target: [0, 2.8, 4.0],
    fov: 55,
  },
  {
    name: '02-Вид со цены в зал',
    pos: [0, 1.6, 3.5],
    target: [0, 1.8, -12.0],
    fov: 62,
  },
  {
    name: '03-Вид на сцену сбоку',
    pos: [-7.0, 1.5, -9.0],
    target: [1.0, 2.2, 1.0],
    fov: 55,
  },
  {
    name: '04-Вид на заднюю стенку',
    pos: [-3.8, 1.4, 4.0],
    target: [0.0, 3.6, 9.2],
    fov: 65,
  },
  {
    name: '05-Вид на узел подъёма на галерею с ближнего правого угла за порталом',
    pos: [6.5, 1.5, 0.8],
    target: [7.6, 2.2, 6.0],
    fov: 60,
  },
  {
    name: '06-Узел подъёма на галерею в дальнем правом углу',
    pos: [4.8, 1.2, 6.2],
    target: [7.2, 2.6, 8.2],
    fov: 65,
  },
  {
    name: '07-Нижняя галерея над задними воротами',
    pos: [3.5, 1.4, 5.5],
    target: [4.6, 2.7, 9.2],
    fov: 60,
  },
  {
    name: '08-Задняя стенка и нижняя галерея вблизи',
    pos: [-2.0, 1.3, 6.5],
    target: [-2.5, 2.2, 9.2],
    fov: 55,
  },
  {
    name: '09-Узел управления штанкетами и софитами',
    pos: [-6.8, 1.4, 1.5],
    target: [-8.0, 2.5, 5.0],
    fov: 55,
  },
  {
    name: '10-Дорога занавеса вид из-за портала поднятое состояние',
    pos: [3.5, 3.2, 0.8],
    target: [0.0, 5.8, 0.55],
    fov: 70,
  },
  {
    name: '11-Вид сферу на С0',
    pos: [-3.0, 6.4, 0.1],
    target: [0.0, 5.2, -1.2],
    fov: 60,
  },
  {
    name: '12-Вид снизу на С1 и линию дежурного освещения 1',
    pos: [0.0, 0.8, 2.5],
    target: [0.0, 7.5, 2.2],
    fov: 70,
  },
  {
    name: '13-Вид снизу на С2',
    pos: [0.0, 0.8, 4.2],
    target: [0.0, 7.5, 4.6],
    fov: 68,
  },
  {
    name: '14-Вид снизу на С3 и линии дежурного освещения 2 и 3',
    pos: [0.0, 0.8, 5.6],
    target: [0.0, 7.5, 6.8],
    fov: 72,
  }
];

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
console.log('Fest app loaded.');

// Hide side panel to give full 3D view
await page.evaluate(() => {
  document.body.classList.add('side-hidden');
  window.__fest.stage.resize();
});

for (const s of shots) {
  console.log(`Rendering shot: ${s.name}`);
  await page.evaluate(({ pos, target, fov }) => {
    const f = window.__fest;
    f.setCamera(pos, target, fov);
  }, s);

  // Run setup in page context
  await page.evaluate((sName) => {
    const f = window.__fest;
    // reset defaults
    f.flag('blueprint', false);
    f.flag('dims', false);
    f.flag('labels', false);
    f.flag('grid', false);
    f.flag('haze', true);
    
    // custom setup
    if (sName.includes('зал')) {
      f.flag('duty', false);
      f.flag('house', true);
      f.light('all', false);
    } else if (sName.includes('Задняя стенка и нижняя галерея вблизи') || sName.includes('Узел управления')) {
      f.flag('duty', true);
      f.flag('house', false);
      f.light('all', false);
    } else {
      f.flag('duty', true);
      f.light('all', true);
      f.flag('house', false);
    }
    f.renderNow();
  }, s.name);

  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${outDir}/${s.name}.jpg`,
    type: 'jpeg',
    quality: 70
  });
}

console.log('All 14 comparative shots captured.');
await browser.close();

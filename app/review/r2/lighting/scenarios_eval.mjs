import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'review/r2/lighting/shots';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  const scenarioResults = await page.evaluate(async () => {
    const fest = window.__fest;
    const stage = fest.stage;

    // 1. Сценарий А: Фронт авансцены и 1 плана
    // Проверим приборы на BR1, BR2, C0, ложах L1/R1, TOW_L/R
    const frontFixtures = stage.fixtures.list.filter(f =>
      ['BR1', 'BR2', 'C0', 'BOX_L1', 'BOX_R1', 'TOW_L', 'TOW_R', 'FOH'].includes(f.group)
    );

    // Анализ геометрии фронта:
    // Авансцена: d от -2.75 до 0. 1-й план сцены: d от 0 до ~3.0 м.
    const frontAnalysis = frontFixtures.map(f => {
      const m = stage.fixtures.mountPos(f);
      const aim = f.aim;
      // Угол падения к горизонту: atan2(dy, horizontal_dist)
      const hDist = Math.hypot(aim.x - m.x, -aim.d - m.z);
      const angleDeg = +(Math.atan2(m.y - aim.y, hDist) * 180 / Math.PI).toFixed(1);
      return {
        no: f.no,
        type: f.type,
        group: f.group,
        mountY: +m.y.toFixed(2),
        mountD: +(-m.z).toFixed(2),
        aimD: aim.d,
        aimX: aim.x,
        angleDeg,
        beam: stage.fixtures.opts?.types?.[f.type]?.beam || 0,
      };
    });

    // 2. Сценарий Б: Контровой свет (Backlight) на 2-м и 3-м планах
    // 2 план: d ~ 3.5 - 6.0 м (софит С2 на d=4.9 м). 3 план: d ~ 6.0 - 9.0 м (софит С3 на d=6.8 м, задняя галерея на d=8.3 м).
    const backFixtures = stage.fixtures.list.filter(f =>
      ['C2', 'C3', 'GAL_B'].includes(f.group)
    );
    const backAnalysis = backFixtures.map(f => {
      const m = stage.fixtures.mountPos(f);
      const aim = f.aim;
      const hDist = Math.hypot(aim.x - m.x, -aim.d - m.z);
      const angleDeg = +(Math.atan2(m.y - aim.y, hDist) * 180 / Math.PI).toFixed(1);
      return {
        no: f.no,
        type: f.type,
        group: f.group,
        mountY: +m.y.toFixed(2),
        mountD: +(-m.z).toFixed(2),
        aimD: aim.d,
        aimX: aim.x,
        angleDeg
      };
    });

    // 3. Сценарий В: Прострелы на штативах и на полу
    stage.setPortable('stand', 8);
    const portStand = stage.fixtures.list.filter(f => f.portable).map(f => ({
      no: f.no,
      side: f.portable.side < 0 ? 'left' : 'right',
      mount: stage.fixtures.mountPos(f),
      aim: f.aim,
    }));

    // 4. Сценарий Г: Генерация скриншота плана для экспликации
    fest.setView('plan');
    fest.flag('blueprint', true);
    fest.flag('fixtureLabels', true);
    fest.flag('dims', true);
    stage.render();

    // 5. Сценарий Д: Передача ссылки shareUrl
    fest.setHeight('C1', 4.5);
    fest.light('all', false);
    fest.light('C1', true);
    fest.light('bridges', true);
    const url = stage.shareUrl();

    // Проверим разбор URL
    const hash = url.split('#')[1] || '';
    const parsedState = stage.getState();

    return {
      frontCount: frontFixtures.length,
      frontAnalysis,
      backCount: backFixtures.length,
      backAnalysis,
      portStand,
      shareUrl: url,
      parsedState
    };
  });

  fs.writeFileSync('review/r2/lighting/scenarios_eval.json', JSON.stringify(scenarioResults, null, 2));
  console.log('Saved scenarios_eval.json');

  // Снимем качественный скриншот чертежа плана для экспликации
  await page.evaluate(() => {
    window.__fest.setView('plan');
    window.__fest.flag('blueprint', true);
    window.__fest.flag('fixtureLabels', true);
    window.__fest.flag('dims', true);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '25-plan-blueprint-hires.jpg'), type: 'jpeg', quality: 85, scale: 'css' });
  console.log('Saved 25-plan-blueprint-hires.jpg');

  // Снимем ракурс прострелов со сцены
  await page.evaluate(() => {
    window.__fest.setView('overview');
    window.__fest.setCamera([0, 2.5, 4.0], [0, 1.2, 0], 55); // со сцены в сторону портала
    window.__fest.flag('blueprint', false);
    window.__fest.light('all', false);
    window.__fest.stage.setPortable('stand', 8);
    window.__fest.light('portable', true);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '26-portable-stand-view-from-stage.jpg'), type: 'jpeg', quality: 75, scale: 'css' });
  console.log('Saved 26-portable-stand-view-from-stage.jpg');

  // Снимем ракурс прострелов с пола
  await page.evaluate(() => {
    window.__fest.stage.setPortable('floor', 8);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '27-portable-floor-view-from-stage.jpg'), type: 'jpeg', quality: 75, scale: 'css' });
  console.log('Saved 27-portable-floor-view-from-stage.jpg');

  await browser.close();
}

run().catch(console.error);

import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'review/r2/lighting/shots';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('Fest is ready on desktop');

  // Сбор данных о приборах
  const fixtureData = await page.evaluate(() => {
    const fest = window.__fest;
    const stage = fest.stage;
    const list = stage.fixtures.list;

    const stats = {
      total: list.length,
      groups: {},
      types: {},
      byMount: { onBar: 0, static: 0, portable: 0 },
      missingAttributesInCard: [],
      fixtureDetails: []
    };

    for (const f of list) {
      stats.groups[f.group] = (stats.groups[f.group] || 0) + 1;
      stats.types[f.type] = (stats.types[f.type] || 0) + 1;
      if (f.portable) stats.byMount.portable++;
      else if (f.mount.on) stats.byMount.onBar++;
      else stats.byMount.static++;

      const mountPos = stage.fixtures.mountPos(f);
      const aim = f.aim;
      const throwDist = Math.hypot(aim.x - mountPos.x, aim.y - mountPos.y, -aim.d - mountPos.z);
      const beamDeg = fest.stage.fixtures.opts?.types?.[f.type]?.beam || 0;

      fest.selectFixture(f.no);
      const desc = fest.describe();

      stats.fixtureDetails.push({
        no: f.no,
        type: f.type,
        group: f.group,
        mount: f.mount,
        mountPos: { x: mountPos.x, y: mountPos.y, z: mountPos.z },
        aim: f.aim,
        throwDist: +throwDist.toFixed(2),
        cardRows: desc ? desc.rows : null,
      });
    }

    fest.select(null);
    return stats;
  });

  fs.writeFileSync('review/r2/lighting/data.json', JSON.stringify(fixtureData, null, 2));
  console.log(`Saved fixture data: ${fixtureData.total} fixtures`);

  // Функция для снимков
  async function shoot(name, prepFn) {
    if (prepFn) await page.evaluate(prepFn);
    await page.waitForTimeout(100);
    const shotPath = path.join(OUT_DIR, name);
    await page.screenshot({ path: shotPath, type: 'jpeg', quality: 70, scale: 'css' });
    console.log(`Saved ${name}`);
  }

  // 1. Дефолтный обзор
  await shoot('01-desktop-overview-default.jpg', () => {
    window.__fest.setView('overview');
    window.__fest.select(null);
  });

  // 2. Чертёж с окраской по типам
  await shoot('02-desktop-plan-blueprint-color.jpg', () => {
    window.__fest.setView('plan');
    window.__fest.flag('blueprint', true);
    window.__fest.flag('fixtureLabels', true);
    window.__fest.flag('dims', true);
  });

  // 3. План с реальными пятнами света
  await shoot('03-desktop-plan-light-pools.jpg', () => {
    window.__fest.setView('plan');
    window.__fest.flag('blueprint', false);
    window.__fest.flag('haze', false);
    window.__fest.flag('grid', true);
    window.__fest.flag('fixtureLabels', false);
  });

  // 4. Соло Мосты
  await shoot('04-desktop-front-bridges.jpg', () => {
    window.__fest.setView('hall');
    window.__fest.stage.soloGroupSet('bridges');
    window.__fest.flag('haze', true);
  });

  // 5. Соло Ложи
  await shoot('05-desktop-front-boxes.jpg', () => {
    window.__fest.setView('hall');
    window.__fest.stage.soloGroupSet('boxes');
  });

  // 6. Соло С0 (покрытие авансцены и 1 плана)
  await shoot('06-desktop-front-c0.jpg', () => {
    window.__fest.setView('hall');
    window.__fest.stage.soloGroupSet('C0');
  });

  // 7. Соло Прострелы (башни на стенах зала)
  await shoot('07-desktop-front-towers.jpg', () => {
    window.__fest.setView('hall');
    window.__fest.stage.soloGroupSet('towers');
  });

  // 8. Соло Пушка FOH
  await shoot('08-desktop-front-foh.jpg', () => {
    window.__fest.setView('hall');
    window.__fest.stage.soloGroupSet('foh');
  });

  // 9. Софиты С2 и С3 (контровой свет) вид со сцены в зал
  await shoot('09-desktop-back-c2-c3.jpg', () => {
    window.__fest.setView('stageToHall');
    window.__fest.light('all', false);
    window.__fest.light('C2', true);
    window.__fest.light('C3', true);
    window.__fest.flag('haze', true);
  });

  // 10. Переносные ETC на полу (8 шт)
  await shoot('10-desktop-portable-floor.jpg', () => {
    window.__fest.setView('hall');
    window.__fest.light('all', false);
    window.__fest.stage.setPortable('floor', 8);
    window.__fest.light('portable', true);
    window.__fest.flag('haze', true);
  });

  // 11. Переносные ETC на штативах (8 шт)
  await shoot('11-desktop-portable-stand.jpg', () => {
    window.__fest.setView('hall');
    window.__fest.stage.setPortable('stand', 8);
    window.__fest.light('portable', true);
    window.__fest.flag('haze', true);
  });

  // 12. Софит С1 опущен до 2.5 м
  await shoot('12-desktop-c1-lowered.jpg', () => {
    window.__fest.setView('overview');
    window.__fest.light('all', true);
    window.__fest.setHeight('C1', 2.5);
    window.__fest.select({ kind: 'rig', id: 'C1' });
    window.__fest.flag('haze', true);
  });

  // 13. Карточка Spot 585 (№ 34 на С0)
  await shoot('13-desktop-card-spot585.jpg', () => {
    window.__fest.setView('overview');
    window.__fest.selectFixture(34);
  });

  // 14. Карточка WashZoom (№ 71 на С1)
  await shoot('14-desktop-card-washzoom.jpg', () => {
    window.__fest.selectFixture(71);
  });

  // 15. Карточка Fresnel (№ 1 на BR1)
  await shoot('15-desktop-card-fresnel.jpg', () => {
    window.__fest.selectFixture(1);
  });

  // 16. Карточка ComPC (№ 119 в BOX_L1)
  await shoot('16-desktop-card-compc.jpg', () => {
    window.__fest.selectFixture(119);
  });

  // 17. Карточка переносного ETC (№ Н1)
  await shoot('17-desktop-card-portable.jpg', () => {
    window.__fest.selectFixture('Н1');
  });

  // 18. Общий вид с лучами (дымка)
  await shoot('18-desktop-haze-beams.jpg', () => {
    window.__fest.setView('hall');
    window.__fest.setHeight('C1', 6.6); // вернуть
    window.__fest.light('all', true);
    window.__fest.flag('haze', true);
    window.__fest.select(null);
  });

  // 19. Дежурный свет
  await shoot('19-desktop-duty-only.jpg', () => {
    window.__fest.setView('hall');
    window.__fest.light('all', false);
    window.__fest.flag('duty', true);
    window.__fest.flag('house', false);
    window.__fest.flag('haze', false);
  });

  // 20. Поиск прибора № 53 в шапке
  await shoot('20-desktop-search-focus.jpg', async () => {
    const input = document.querySelector('header .search-row input');
    if (input) {
      input.value = '53';
      const btn = document.querySelector('header .search-row button');
      btn?.click();
    }
  });

  await context.close();

  // Мобильная версия: портрет
  const mContextPortrait = await browser.newContext({
    ...devices['iPhone 14'],
  });
  const mPageP = await mContextPortrait.newPage();
  await mPageP.goto('http://localhost:5173/mobile.html');
  await mPageP.waitForFunction(() => window.__fest?.ready);

  // Открыть шторку на вкладке «Свет»
  await mPageP.evaluate(() => {
    const lightTab = document.querySelector('.tabs button[data-tab="light"]');
    lightTab?.click();
  });
  await mPageP.waitForTimeout(200);
  await mPageP.screenshot({ path: path.join(OUT_DIR, '21-mobile-portrait-sheet-light.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  console.log('Saved 21-mobile-portrait-sheet-light.jpg');

  // Выбрать прибор № 38 на мобилке
  await mPageP.evaluate(() => {
    window.__fest.selectFixture(38);
  });
  await mPageP.waitForTimeout(200);
  await mPageP.screenshot({ path: path.join(OUT_DIR, '22-mobile-portrait-card.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  console.log('Saved 22-mobile-portrait-card.jpg');

  await mContextPortrait.close();

  // Мобильная версия: ландшафт
  const mContextLandscape = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mPageL = await mContextLandscape.newPage();
  await mPageL.goto('http://localhost:5173/mobile.html');
  await mPageL.waitForFunction(() => window.__fest?.ready);

  await mPageL.evaluate(() => {
    const lightTab = document.querySelector('.tabs button[data-tab="light"]');
    lightTab?.click();
  });
  await mPageL.waitForTimeout(200);
  await mPageL.screenshot({ path: path.join(OUT_DIR, '23-mobile-landscape-sheet.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  console.log('Saved 23-mobile-landscape-sheet.jpg');

  await mPageL.evaluate(() => {
    window.__fest.selectFixture(34);
  });
  await mPageL.waitForTimeout(200);
  await mPageL.screenshot({ path: path.join(OUT_DIR, '24-mobile-landscape-card.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  console.log('Saved 24-mobile-landscape-card.jpg');

  await mContextLandscape.close();
  await browser.close();
  console.log('All tests completed successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

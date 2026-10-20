import { chromium } from '@playwright/test';

async function checkFixes() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  const results = await page.evaluate(async () => {
    const fest = window.__fest;
    const stage = fest.stage;
    const report = {};

    // 1. Поиск прибора в шапке
    const topSearch = document.querySelector('header .search-row input');
    const topSearchBtn = document.querySelector('header .search-row button');
    report.topSearchExists = !!(topSearch && topSearchBtn);

    // 2. Поиск прибора в панели «Свет»
    const lightTabBtn = Array.from(document.querySelectorAll('.tabs button')).find(b => b.textContent.includes('Свет'));
    lightTabBtn?.click();
    const lightSearch = document.querySelector('.panel-light .search-row input');
    report.lightSearchExists = !!lightSearch;

    // 3. Выбор прибора раскрывает его группу
    fest.selectFixture(71); // WashZoom на С1
    const c1Details = Array.from(document.querySelectorAll('.panel-light details')).find(d => d.querySelector('summary')?.textContent.includes('Софит 1'));
    report.groupOpensOnSelect = !!(c1Details && c1Details.open);

    // 4. Кнопки «соло» групп
    const soloBtns = document.querySelectorAll('.panel-light .solo');
    report.soloBtnsCount = soloBtns.length;

    // 5. Окраска приборов по типу в режиме чертежа и экспликация
    fest.setView('plan');
    fest.flag('blueprint', true);
    report.blueprintActive = stage.flags.blueprint;
    report.legendExists = !!stage.sheet;

    // 6. Подписи канатов
    fest.setView('overview');
    const ropeLabelsVisibleOverview = stage.labels.labels.filter(s => s.userData.label?.kind === 'rope' && s.visible).length;
    fest.setView('flyGallery');
    const ropeLabelsVisibleFly = stage.labels.labels.filter(s => s.userData.label?.kind === 'rope' && s.visible).length;
    report.ropeLabelsOverview = ropeLabelsVisibleOverview;
    report.ropeLabelsFlyGallery = ropeLabelsVisibleFly;

    // 7. Сдвиг ЛКМ на плане
    fest.setView('plan');
    const mousePanOnPlan = stage.controls.mouseButtons.LEFT === 2; // THREE.MOUSE.PAN === 2
    report.mousePanOnPlan = mousePanOnPlan;

    // 8. Переносные приборы
    stage.setPortable('stand', 8);
    report.portableStandCount = stage.fixtures.list.filter(f => f.portable && !f.hidden).length;

    return report;
  });

  console.log('Fixes check:', JSON.stringify(results, null, 2));
  await browser.close();
}

checkFixes().catch(console.error);

// Шаг 6. Самопроверка: снимки всех видов на десктопе и телефонах.
// Снимки: review/shots/<раунд>/<проект>/NN-<вид>.jpg  (раунд — переменная ROUND, по умолчанию r1-self).
// Заодно проверяет: страница открывается без ошибок в консоли, кадр не пустой,
// стартовая страница рекомендует правильную версию, интерфейс не вылезает за экран.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openApp, applyShot, canvasStats, expectNoErrors } from './helpers.js';

const ROUND = process.env.ROUND || 'r1-self';

/** Все готовые виды + «сюжетные» снимки для проверки света, механики и чертежа. */
const SHOTS = [
  'overview', 'hall', 'booth', 'plan', 'planStage', 'section', 'stageToHall', 'upperGallery', 'flyGallery',
  'plan+bp+dims',       // чертёж для райдера (экспликация, масштаб)
  'plan+bp+grid',       // чертёж с оцифрованной сеткой 1 м
  'planStage+bp+dims',  // план сцены крупно — лист развеса
  'section+bp+dims+grid', // разрез: высоты штанкетов, вся глубина здания
  'hall+off',           // сценический свет выключен, горит дежурка
  'hall+off+noduty+house', // только зальный свет
  'hall+onlyC2',        // включён только 2-й софит
  'overview+low',       // Ш3, Ш5, Ш9 опущены до 2 м, С2 до 3 м
  'flyGallery+low',     // противовесы этих штанкетов поднялись
  'hall+pstand',        // переносные ETC на штативах
  'overview+nums',      // номера приборов
  'overview+sel53',     // карточка прибора № 53
  'hall+selSh5',        // карточка штанкета Ш5
];

test('снимки всех видов', async ({ page }, info) => {
  test.skip(!!process.env.VENUE && process.env.VENUE !== 'big', 'снимается только площадка VENUE');
  const mobile = !!info.project.use.isMobile;
  const dir = `review/shots/${ROUND}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  const log = await openApp(page, mobile ? 'mobile.html' : 'desktop.html');
  const report = { project: info.project.name, viewport: page.viewportSize(), readyMs: log.readyMs, shots: [] };

  let n = 0;
  for (const spec of SHOTS) {
    await test.step(spec, async () => {
      await applyShot(page, spec);
      const st = await canvasStats(page);
      const file = `${String(++n).padStart(2, '0')}-${spec.replace(/\+/g, '_')}.jpg`;
      await page.screenshot({ path: `${dir}/${file}`, type: 'jpeg', quality: 80, scale: 'css' });
      report.shots.push({ spec, file, ...st });
      // кадр не однотонный (сцена действительно нарисована)
      expect.soft(st.std, `${spec}: пустой кадр (разброс яркости ${st.std})`).toBeGreaterThan(4);
    });
  }

  // панели интерфейса: каждая вкладка открыта
  const tabs = mobile ? ['rig', 'light', 'views', 'layers'] : ['rig', 'light', 'layers', 'views'];
  await applyShot(page, 'overview');
  for (const tab of tabs) {
    await test.step(`вкладка ${tab}`, async () => {
      await page.locator(mobile ? `.mtab[data-tab="${tab}"]` : `.tab[data-tab="${tab}"]`).click();
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${dir}/${String(++n).padStart(2, '0')}-ui-${tab}.jpg`, type: 'jpeg', quality: 80, scale: 'css' });
      // ничего не вылезает за правый край экрана
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect.soft(overflow, `вкладка ${tab}: горизонтальная прокрутка ${overflow} px`).toBeLessThanOrEqual(0);
    });
  }

  // проверка кнопок экспорта (4 на десктопе, 2 на мобильном)
  await test.step('кнопки экспорта', async () => {
    const expectedIds = mobile ? ['plan-dxf', 'section-dxf'] : ['plan-dxf', 'section-dxf', '3d-dxf', '3d-glb'];
    const panelIds = await page.evaluate(() => [...document.querySelectorAll('.export-panel [data-export]')].map((b) => b.dataset.export));
    expect.soft(panelIds, 'кнопки экспорта во вкладке Виды').toEqual(expectedIds);
    const menuSel = mobile ? '.share-menu [data-export]' : '.export-menu [data-export]';
    const menuIds = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((b) => b.dataset.export), menuSel);
    expect.soft(menuIds, 'кнопки экспорта в быстром меню').toEqual(expectedIds);
  });

  // на телефоне: кнопки не мельче 44 px (рекомендация Apple / WCAG 2.5.5) — во всех вкладках и в карточках
  if (mobile) {
    await test.step('размер кнопок', async () => {
      const measure = () => page.evaluate(() => [...document.querySelectorAll('button, [role=button], input, select, summary')]
        .filter((el) => el.offsetParent && el.getClientRects().length && !el.closest('[hidden]'))
        .map((el) => ({ r: el.getBoundingClientRect(), t: (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 30) }))
        .filter(({ r }) => r.width > 0 && Math.min(r.width, r.height) < 44 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)
        .map(({ r, t }) => `${t} (${Math.round(r.width)}×${Math.round(r.height)})`));
      const small = new Set();
      for (const tab of tabs) {
        await page.locator(`.mtab[data-tab="${tab}"]`).click();
        if (!(await page.locator('.sheet[data-state=open]').count())) await page.locator(`.mtab[data-tab="${tab}"]`).click();
        await page.evaluate(() => document.querySelectorAll('details.grp').forEach((d, i) => { d.open = i === 0; }));
        await page.waitForTimeout(300);
        for (const s of await measure()) small.add(`[${tab}] ${s}`);
      }
      await page.locator('.handle').click(); // свернуть шторку
      for (const sel of ['selSh5', 'sel53']) {
        await applyShot(page, `overview+${sel}`);
        for (const s of await measure()) small.add(`[карточка ${sel}] ${s}`);
      }
      report.smallTargets = [...small];
      expect.soft([...small], 'кнопки мельче 44 px').toEqual([]);
    });
  }

  report.stats = await page.evaluate(() => window.__fest.stats());
  report.errors = log.errors;
  report.warnings = log.warnings.slice(0, 20);
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 1));
  expectNoErrors(log);
});

test('стартовая страница: карточки сцен и рекомендация версии', async ({ page }, info) => {
  const mobile = !!info.project.use.isMobile;
  const dir = `review/shots/${ROUND}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('index.html#s=test');
  await expect(page.locator('h1')).toContainText('Театр ФЭСТ');
  // пять сцен; у открываемых — кнопки «Компьютер» и «Телефон», без выделения «рекомендованной»
  await expect(page.locator('.venue-card')).toHaveCount(5);
  await expect(page.locator('.venue-card[data-venue="chamber"] a[data-device="mob"]')).toHaveAttribute('href', /mobile\.html#v=chamber$/);
  await expect(page.locator('.venue-links .btn.on')).toHaveCount(0);
  await expect(page.locator('.venue-card.soon a')).toHaveCount(0);
  await expect(page.locator('#rec')).toContainText(mobile ? 'мобильную' : 'полную');
  // старая ссылка с состоянием (#s=… — Большая сцена) передаётся в кнопки Большой сцены
  await expect(page.locator('.venue-card[data-venue="big"] a[data-device="desk"]')).toHaveAttribute('href', /desktop\.html#s=test$/);
  await page.screenshot({ path: `${dir}/00-index.jpg`, type: 'jpeg', quality: 80, scale: 'css' });
  expect(errors).toEqual([]);
});

// Остальные площадки каталога: все их виды + чертёж/размеры/сетка и свет.
// Снимки: review/shots/<раунд>/<проект>/<площадка>/NN-<вид>.jpg. VENUE=chamber — только одна площадка.
const OTHER_VENUES = (process.env.VENUE ? [process.env.VENUE] : ['chamber', 'roof']).filter((v) => v !== 'big');
/** Дополнительные снимки площадки: планировки трансформируемого зала. */
const EXTRA_SHOTS = { roof: ['cross', 'traverse', 'arena'].flatMap((lo) => [`overview+lo-${lo}`, `plan+lo-${lo}`]) };
for (const venue of OTHER_VENUES) {
  test(`снимки площадки: ${venue}`, async ({ page }, info) => {
    const mobile = !!info.project.use.isMobile;
    const dir = `review/shots/${ROUND}/${info.project.name}/${venue}`;
    mkdirSync(dir, { recursive: true });
    const log = await openApp(page, `${mobile ? 'mobile.html' : 'desktop.html'}#v=${venue}`);
    expect(await page.evaluate(() => window.__fest.venue())).toBe(venue);
    const views = await page.evaluate(() => window.__fest.views);
    const ortho = await page.evaluate(() => Object.entries(window.__fest.stage.views).filter(([, v]) => v.type === 'ortho').map(([k]) => k));
    const specs = [...views, ...ortho.map((k) => `${k}+bp+dims`), ...ortho.slice(0, 1).map((k) => `${k}+bp+grid`), `${views[0]}+off+house`, `${views[0]}+nums`, ...(EXTRA_SHOTS[venue] || [])];
    let n = 0;
    for (const spec of specs) {
      await test.step(spec, async () => {
        await applyShot(page, spec);
        const st = await canvasStats(page);
        await page.screenshot({ path: `${dir}/${String(++n).padStart(2, '0')}-${spec.replace(/\+/g, '_')}.jpg`, type: 'jpeg', quality: 80, scale: 'css' });
        // «чертёж» — светлый лист, проверка строгая; без него чёрный кабинет тёмный по природе
        // (разрез сбоку — в основном чёрная дальняя стена), поэтому порог ниже
        const minStd = spec.includes('+bp') ? 4 : 1.5;
        expect.soft(st.std, `${venue} ${spec}: пустой кадр (разброс яркости ${st.std})`).toBeGreaterThan(minStd);
      });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect.soft(overflow, 'горизонтальная прокрутка').toBeLessThanOrEqual(0);
    writeFileSync(`${dir}/report.json`, JSON.stringify({ venue, stats: await page.evaluate(() => window.__fest.stats()), errors: log.errors }, null, 1));
    expectNoErrors(log);
  });
}

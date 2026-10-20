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
  'overview', 'hall', 'booth', 'plan', 'section', 'stageToHall', 'upperGallery', 'flyGallery',
  'plan+bp+dims',       // чертёж для райдера
  'section+bp+dims',    // разрез: высоты штанкетов
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

  // на телефоне: кнопки не мельче 44 px (рекомендация Apple / WCAG 2.5.5)
  if (mobile) {
    await test.step('размер кнопок', async () => {
      await page.locator('.mtab[data-tab="light"]').click(); // шторка открыта на «Свете»
      await page.waitForTimeout(300);
      const small = await page.evaluate(() => [...document.querySelectorAll('button, [role=button], input[type=range], select')]
        .filter((el) => el.offsetParent && el.getClientRects().length)
        .map((el) => ({ r: el.getBoundingClientRect(), t: (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 30) }))
        .filter(({ r }) => r.width > 0 && Math.min(r.width, r.height) < 44 && r.bottom > 0 && r.top < innerHeight)
        .map(({ r, t }) => `${t} (${Math.round(r.width)}×${Math.round(r.height)})`));
      report.smallTargets = small;
      expect.soft(small, 'кнопки мельче 44 px').toEqual([]);
    });
  }

  report.stats = await page.evaluate(() => window.__fest.stats());
  report.errors = log.errors;
  report.warnings = log.warnings.slice(0, 20);
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 1));
  expectNoErrors(log);
});

test('стартовая страница рекомендует нужную версию', async ({ page }, info) => {
  const mobile = !!info.project.use.isMobile;
  const dir = `review/shots/${ROUND}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('index.html#s=test');
  await expect(page.locator(mobile ? '#mob' : '#desk')).toHaveClass(/rec/);
  // ссылка с состоянием передаётся дальше
  await expect(page.locator('#desk')).toHaveAttribute('href', /desktop\.html#s=test$/);
  await page.screenshot({ path: `${dir}/00-index.jpg`, type: 'jpeg', quality: 80, scale: 'css' });
  expect(errors).toEqual([]);
});

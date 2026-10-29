// Каталог сцен: переключение площадок в интерфейсе, память состояния, утечки, старые ссылки.
import { test, expect } from '@playwright/test';
import { openApp, canvasStats, expectNoErrors } from './helpers.js';

const pageOf = (info) => (info.project.use.isMobile ? 'mobile.html' : 'desktop.html');
const tabSel = (info) => (info.project.use.isMobile ? '.mtab' : '.tab');

/** Выбрать сцену через заголовок-список (как человек). */
async function pickVenue(page, id) {
  await page.locator('.brand-btn').click();
  await expect(page.locator('dialog.venue-picker[open]')).toBeVisible();
  await page.locator(`.venue-item[data-venue="${id}"]`).click();
  await page.waitForFunction((id) => window.__fest.venue() === id, id);
  await page.waitForTimeout(300);
}

test('переключение сцены через список в заголовке', async ({ page }, info) => {
  const log = await openApp(page, pageOf(info));
  expect(await page.evaluate(() => window.__fest.venue())).toBe('big');
  await expect(page.locator(`${tabSel(info)}[data-tab="rig"]`)).toHaveCount(1);

  await pickVenue(page, 'chamber');
  await expect(page.locator('.brand-btn')).toContainText('Камерная');
  expect(await page.evaluate(() => location.hash)).toMatch(/^#v=chamber&s=/);
  // у Камерной нет подвижной механики и переносных приборов — вкладки и блока нет
  await expect(page.locator(`${tabSel(info)}[data-tab="rig"]`)).toHaveCount(0);
  await expect(page.locator('.panel-light h4', { hasText: 'Переносные' })).toHaveCount(0);
  await expect(page.locator('[data-id="l-trusses"]')).toHaveCount(1);
  expect((await canvasStats(page)).std, 'Камерная: кадр не пустой').toBeGreaterThan(4);

  // «скоро» — видна, но не открывается; ответ — строкой внутри списка (тост под модальной шторкой не виден)
  await page.locator('.brand-btn').click();
  for (const id of ['foyer', 'studio']) await expect(page.locator(`.venue-item[data-venue="${id}"]`)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.venue-item[data-venue="roof"]'), 'Сцена под крышей открывается').not.toHaveAttribute('aria-disabled', 'true');
  // aria-disabled — кнопка всё же нажимается (показывает пояснение), Playwright без force ждал бы «включения»
  await page.locator('.venue-item[data-venue="foyer"]').click({ force: true });
  await expect(page.locator('.venue-note')).toContainText('готовится');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__fest.venue())).toBe('chamber');
  // справка и раздел экспорта не содержат пустых пунктов
  if (!info.project.use.isMobile) await expect(page.locator('.help li', { hasText: 'null' })).toHaveCount(0);

  await pickVenue(page, 'big');
  await expect(page.locator(`${tabSel(info)}[data-tab="rig"]`)).toHaveCount(1);
  expectNoErrors(log);
});

test('память сцен: механика и дежурный свет свои, режимы отображения общие', async ({ page }, info) => {
  const log = await openApp(page, pageOf(info));
  await page.evaluate(() => { window.__fest.setHeight('Sh5', 2); window.__fest.flag('blueprint', true); window.__fest.flag('duty', false); });
  await page.evaluate(() => window.__fest.loadVenue('chamber'));
  expect(await page.evaluate(() => window.__fest.getState().flags.blueprint), 'чертёж переносится на новую сцену').toBe(true);
  expect(await page.evaluate(() => window.__fest.getState().flags.duty), 'дежурный свет у Камерной свой (исходно включён)').toBe(true);
  await page.evaluate(() => window.__fest.flag('blueprint', false));
  await page.evaluate(() => window.__fest.loadVenue('big'));
  expect(await page.evaluate(() => window.__fest.height('Sh5')), 'Большая сцена помнит свои высоты').toBe(2);
  expect(await page.evaluate(() => window.__fest.getState().flags.duty), 'и свой дежурный свет').toBe(false);
  expect(await page.evaluate(() => window.__fest.getState().flags.blueprint)).toBe(false);
  await expect(page.locator('.rig-row[data-id="Sh5"] input.num')).toHaveValue('2.00');
  expectNoErrors(log);
});

test('дежурка: LED и синие приборы сохраняют свой материал после смены сцены', async ({ page }, info) => {
  const log = await openApp(page, pageOf(info));
  const names = () => page.evaluate(() => window.__fest.stage.emitters.duty.children.filter((m) => m.userData.emitter).map((m) => m.material.name));
  const before = await names();
  await page.evaluate(async () => { const f = window.__fest; f.flag('duty', false); await f.loadVenue('chamber'); f.flag('duty', false); await f.loadVenue('big'); f.flag('duty', true); });
  expect(await names()).toEqual(before);
  expectNoErrors(log);
});

test('нет утечек при переключении (10 циклов)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' && info.project.name !== 'iphone', 'достаточно двух профилей');
  const log = await openApp(page, pageOf(info));
  const mem = () => page.evaluate(async () => {
    await window.__fest.loadVenue('chamber');
    await window.__fest.loadVenue('big');
    window.__fest.renderNow();
    const st = window.__fest.stage, i = st.renderer.info;
    return {
      g: i.memory.geometries, t: i.memory.textures, p: i.programs.length,
      l: Object.values(st.listeners).reduce((n, a) => n + a.length, 0), // подписки панелей
      dom: document.getElementsByTagName('*').length, // плашки, панели, диалоги
    };
  });
  const first = await mem();
  let last = first;
  for (let i = 0; i < 9; i++) last = await mem();
  console.log(`[${info.project.name}] память: после 1-го цикла ${JSON.stringify(first)}, после 10-го ${JSON.stringify(last)}`);
  expect(Math.abs(last.g - first.g), 'геометрии').toBeLessThanOrEqual(2);
  expect(Math.abs(last.t - first.t), 'текстуры').toBeLessThanOrEqual(2);
  expect(last.l, 'подписки на события движка').toBe(first.l);
  expect(Math.abs(last.dom - first.dom), 'узлы DOM').toBeLessThanOrEqual(5);
  expect(Math.abs(last.p - first.p), 'шейдерные программы').toBeLessThanOrEqual(2);
  expectNoErrors(log);
});

test('ссылки: на сцену, на «скоро», старая v1', async ({ page }, info) => {
  const url = pageOf(info);
  // прямая ссылка на Камерную
  let log = await openApp(page, `${url}#v=chamber`);
  expect(await page.evaluate(() => window.__fest.venue())).toBe('chamber');
  expectNoErrors(log);
  // сцена «скоро» — открывается Большая и объясняется почему
  await page.goto('about:blank');
  log = await openApp(page, `${url}#v=foyer`);
  expect(await page.evaluate(() => window.__fest.venue())).toBe('big');
  await expect(page.locator('.toast', { hasText: 'в разработке' })).toHaveCount(1);
  // старая ссылка v1 (до каталога): Ш5 на 2 м, вид «из зала»
  const v1 = await page.evaluate(() => {
    const v = window.__fest.stage.venue;
    const h = v.rigging.list.map((r) => Math.round((r.id === 'Sh5' ? 2 : r.rest) * 100));
    const bytes = new Uint8Array(Math.ceil(v.fixtures.list.length / 8)).fill(255);
    const b = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b(new TextEncoder().encode(JSON.stringify({ v: 1, h, fx: b(bytes), f: 1, l: 31, view: 'hall' })));
  });
  await page.goto('about:blank');
  log = await openApp(page, `${url}#s=${v1}`);
  expect(await page.evaluate(() => [window.__fest.venue(), window.__fest.height('Sh5'), window.__fest.getState().view])).toEqual(['big', 2, 'hall']);
  expectNoErrors(log);
});

test('список сцен на телефоне: пункты не мельче 44 px', async ({ page }, info) => {
  test.skip(!info.project.use.isMobile, 'только телефон');
  const log = await openApp(page, 'mobile.html');
  await page.locator('.brand-btn').click();
  const small = await page.evaluate(() => [...document.querySelectorAll('.venue-picker button, .brand-btn')]
    .map((el) => ({ r: el.getBoundingClientRect(), t: (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 24) }))
    .filter(({ r }) => r.width > 0 && Math.min(r.width, r.height) < 44)
    .map(({ r, t }) => `${t} (${Math.round(r.width)}×${Math.round(r.height)})`));
  expect(small).toEqual([]);
  expectNoErrors(log);
});

// --- Сцена под крышей: трансформируемый зал (caps.layouts) -------------------------------------
/** Поле lo строки состояния (ссылки). */
const loOf = (s) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))).lo;

test('Сцена под крышей: ссылка, вкладка «Зал», планировка в ссылке, память', async ({ page }, info) => {
  const mobile = !!info.project.use.isMobile;
  const log = await openApp(page, `${pageOf(info)}#v=roof`);
  expect(await page.evaluate(() => window.__fest.venue())).toBe('roof');
  // ссылка без lo — «Стандарт», все ряды, без сдвига
  expect(await page.evaluate(() => window.__fest.layout())).toEqual({ id: 'std', rows: 5, shift: 0 });
  expect(await page.evaluate(() => window.__fest.stage.layers.ceiling), 'слой «Потолок и балки» скрыт по умолчанию').toBe(false);
  expect(await page.evaluate(() => window.__fest.stage.layerGroups.ceiling.visible), 'группа мешей потолка невидима').toBe(false);
  await expect(page.locator(`${tabSel(info)}[data-tab="rig"]`)).toHaveCount(0);
  await expect(page.locator(`${tabSel(info)}[data-tab="hall"]`)).toHaveCount(1);
  await page.locator(`${tabSel(info)}[data-tab="hall"]`).click();
  if (mobile && !(await page.locator('.sheet[data-state=open]').count())) await page.locator('.mtab[data-tab="hall"]').click();
  await page.locator('.layout-btn[data-layout="traverse"]').click();
  expect(await page.evaluate(() => window.__fest.layout())).toEqual({ id: 'traverse', rows: 3, shift: 0 });
  expect(loOf(await page.evaluate(() => window.__fest.stage.stateString()))).toEqual([4, 3, 0]);
  // степперы: в «Траверсе» сдвиг 0…0 — кнопки сдвига выключены; «Рядов» − работает
  await expect(page.locator('[data-step="shift+"]')).toBeDisabled();
  await page.locator('[data-step="rows-"]').click();
  expect(await page.evaluate(() => window.__fest.layout().rows)).toBe(2);
  await page.locator('[data-step="rows+"]').click();
  // память: Камерная и обратно — «Траверс» на месте; выбор в шапке пишет lo в адрес
  await pickVenue(page, 'chamber');
  await pickVenue(page, 'roof');
  expect(await page.evaluate(() => window.__fest.layout().id)).toBe('traverse');
  const s = await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('s'));
  expect(loOf(s)).toEqual([4, 3, 0]);
  // «Пустой зал»: степперы скрыты, мест нет
  await page.evaluate(() => window.__fest.setLayout({ id: 'empty' }));
  expect(await page.evaluate(() => window.__fest.stage.layerGroups.hall.children.at(-1).children.find((m) => m.name === 'seatsFabric').count)).toBe(0);
  expectNoErrors(log);
});

test('Сцена под крышей: смена планировок без утечек; «чертёж» сразу у нового зала; пятна на станках', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' && info.project.name !== 'iphone', 'достаточно двух профилей');
  const log = await openApp(page, `${pageOf(info)}#v=roof`);
  const mem = () => page.evaluate(() => {
    const f = window.__fest;
    for (const id of ['std', 'traverse', 'empty', 'arena']) f.setLayout({ id });
    f.renderNow();
    const i = f.stage.renderer.info;
    return { g: i.memory.geometries, t: i.memory.textures, p: i.programs.length };
  });
  const first = await mem();
  let last = first;
  for (let i = 0; i < 9; i++) last = await mem();
  console.log(`[${info.project.name}] планировки: после 1-го цикла ${JSON.stringify(first)}, после 10-го ${JSON.stringify(last)}`);
  expect(Math.abs(last.g - first.g), 'геометрии').toBeLessThanOrEqual(2);
  expect(Math.abs(last.t - first.t), 'текстуры').toBeLessThanOrEqual(2);
  expect(Math.abs(last.p - first.p), 'шейдерные программы').toBeLessThanOrEqual(2);

  // «чертёж» включён → новая планировка сразу в материалах чертежа, выключили → исходные
  const bp = await page.evaluate(() => {
    const f = window.__fest;
    f.flag('blueprint', true);
    f.setLayout({ id: 'arena' });
    const meshes = [];
    f.stage.layerGroups.hall.traverse((o) => { if (o.isMesh && o.type !== 'LineSegments') meshes.push(o); });
    const on = meshes.every((m) => m.userData.matOrig && m.material !== m.userData.matOrig);
    f.flag('blueprint', false);
    const off = meshes.every((m) => m.material === m.userData.matOrig);
    return { n: meshes.length, on, off };
  });
  expect(bp.n).toBeGreaterThan(0);
  expect(bp.on, 'у мешей нового зала материалы чертежа').toBe(true);
  expect(bp.off, 'после выключения — исходные').toBe(true);

  // пятна: ComPC № 105 (наведён на d 5,5) в «Траверсе» ложится на верх станка 0,2, в «Пустом зале» — на пол
  const poolY = () => page.evaluate(() => {
    const f = window.__fest, fx = f.stage.fixtures, it = fx.byNo.get('105');
    const m = new window.__fest.stage.camera.matrixWorld.constructor();
    fx.pools.getMatrixAt(it.idx, m);
    return m.elements[13];
  });
  await page.evaluate(() => { window.__fest.light('all', true); window.__fest.setLayout({ id: 'traverse' }); });
  expect(await poolY()).toBeCloseTo(0.2 + 0.012, 2);
  await page.evaluate(() => window.__fest.setLayout({ id: 'empty' }));
  expect(await poolY()).toBeCloseTo(0.012, 2);
  expectNoErrors(log);
});

test('Сцена под крышей на телефоне: кнопки вкладки «Зал» не мельче 44 px', async ({ page }, info) => {
  test.skip(!info.project.use.isMobile, 'только телефон');
  const log = await openApp(page, 'mobile.html#v=roof');
  await page.locator('.mtab[data-tab="hall"]').click();
  if (!(await page.locator('.sheet[data-state=open]').count())) await page.locator('.mtab[data-tab="hall"]').click();
  await page.waitForTimeout(300);
  const small = await page.evaluate(() => [...document.querySelectorAll('.panel-layout button')]
    .filter((el) => el.offsetParent)
    .map((el) => ({ r: el.getBoundingClientRect(), t: (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 24) }))
    .filter(({ r }) => r.width > 0 && Math.min(r.width, r.height) < 44)
    .map(({ r, t }) => `${t} (${Math.round(r.width)}×${Math.round(r.height)})`));
  expect(small).toEqual([]);
  expectNoErrors(log);
});

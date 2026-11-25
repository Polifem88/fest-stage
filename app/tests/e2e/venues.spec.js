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

  // все 5 площадок открываются; черновики (Фойе и Студия) отмечены пометкой «черновик»
  await page.locator('.brand-btn').click();
  for (const id of ['foyer', 'studio']) {
    await expect(page.locator(`.venue-item[data-venue="${id}"]`)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator(`.venue-item[data-venue="${id}"]`)).toContainText('черновик');
  }
  await expect(page.locator('.venue-item[data-venue="roof"]'), 'Сцена под крышей открывается').not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__fest.venue())).toBe('chamber');
  // справка и раздел экспорта не содержат пустых пунктов
  if (!info.project.use.isMobile) await expect(page.locator('.help li', { hasText: 'null' })).toHaveCount(0);

  await pickVenue(page, 'foyer');
  await expect(page.locator('.brand-btn')).toContainText('Фойе');
  expect(await page.evaluate(() => location.hash)).toMatch(/^#v=foyer&s=/);
  expect((await canvasStats(page)).std, 'Фойе: кадр не пустой').toBeGreaterThan(4);

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

test('ссылки: на сцену, на неизвестную, старая v1', async ({ page }, info) => {
  const url = pageOf(info);
  // прямая ссылка на Камерную
  let log = await openApp(page, `${url}#v=chamber`);
  expect(await page.evaluate(() => window.__fest.venue())).toBe('chamber');
  expectNoErrors(log);
  // прямая ссылка на Фойе (черновик)
  await page.goto('about:blank');
  log = await openApp(page, `${url}#v=foyer`);
  expect(await page.evaluate(() => window.__fest.venue())).toBe('foyer');
  expectNoErrors(log);
  // несуществующая сцена — открывается Большая и объясняется почему
  await page.goto('about:blank');
  log = await openApp(page, `${url}#v=nonexistent`);
  expect(await page.evaluate(() => window.__fest.venue())).toBe('big');
  await expect(page.locator('.toast', { hasText: 'не найдена' })).toHaveCount(1);
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
  expect(await page.evaluate(() => window.__fest.stage.layers.duty), 'слой «Свет (дежурка)» включён по умолчанию').toBe(true);
  expect(await page.evaluate(() => window.__fest.stage.layerGroups.duty.visible), 'группа дежурки видима').toBe(true);
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

test('Студия мультимедиа: вкладки, блитчер с двухфазной анимацией, подвижная ферма и память', async ({ page }, info) => {
  const mobile = !!info.project.use.isMobile;
  const log = await openApp(page, `${pageOf(info)}#v=studio`);
  expect(await page.evaluate(() => window.__fest.venue())).toBe('studio');
  expect((await canvasStats(page)).std, 'Студия: кадр не пустой').toBeGreaterThan(4);

  for (const tab of ['rig', 'light', 'hall', 'layers', 'views']) {
    await expect(page.locator(`${tabSel(info)}[data-tab="${tab}"]`)).toHaveCount(1);
  }
  if (!mobile) {
    const helpTxt = await page.evaluate(() => document.querySelector('.modal')?.textContent || '');
    expect(helpTxt).not.toContain('«Рядов»');
  }
  expect(await page.evaluate(() => window.__fest.layout())).toEqual({ id: 'folded', rows: 0, shift: 0 });
  expect(await page.evaluate(() => window.__fest.height('MF'))).toBe(4.5);
  expect(await page.evaluate(() => window.__fest.stage.layerGroups.hall.children.at(-1).children.find((m) => m.name === 'seatsFabric').count)).toBe(0);

  // Вкладка «Зал»: степперы Рядов/Сдвига скрыты, клик по «Разложен со стульями» запускает анимацию → 40 мест
  await page.locator(`${tabSel(info)}[data-tab="hall"]`).click();
  if (mobile && !(await page.locator('.sheet[data-state=open]').count())) await page.locator('.mtab[data-tab="hall"]').click();
  await expect(page.locator('.panel-layout .steppers')).toBeHidden();
  await page.locator('.layout-btn[data-layout="unfolded"]').click();
  // прерывание в середине анимации и повторный запуск не ломают финальное состояние
  await page.waitForTimeout(180);
  await page.locator('.layout-btn[data-layout="folded"]').click();
  await page.waitForTimeout(180);
  await page.locator('.layout-btn[data-layout="unfolded"]').click();
  await page.waitForFunction(() => !window.__fest.stage._hallAnim
    && window.__fest.stage.layerGroups.hall.children.at(-1)?.children.find((m) => m.name === 'seatsFabric')?.count === 40);
  expect(loOf(await page.evaluate(() => window.__fest.stage.stateString()))).toEqual([1, 5, 0]);

  // Опускаем подвижную ферму на 2,00 м, переключаемся на Сцену под крышей и обратно — состояние Студии сохранено
  await page.evaluate(() => window.__fest.setHeight('MF', 2));
  if (mobile && await page.locator('.sheet[data-state=open]').count()) await page.locator('.handle').click();
  await pickVenue(page, 'roof');
  await pickVenue(page, 'studio');
  expect(await page.evaluate(() => window.__fest.layout().id)).toBe('unfolded');
  expect(await page.evaluate(() => window.__fest.height('MF'))).toBe(2);
  const s = await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('s'));
  expect(loOf(s)).toEqual([1, 5, 0]);
  expectNoErrors(log);
});

test('Студия мультимедиа: 10 циклов без утечек, чертёж, пятна на блитчере, 3D-захват рамы и экспорт', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' && info.project.name !== 'iphone', 'достаточно двух профилей');
  const mobile = !!info.project.use.isMobile;
  const log = await openApp(page, `${pageOf(info)}#v=studio`);

  const mem = () => page.evaluate(() => {
    const f = window.__fest;
    f.stage.setLayout({ id: 'unfolded' }, { animate: true });
    f.stage._stepHallAnim(performance.now() + 300);
    f.setLayout({ id: 'folded' });
    f.setLayout({ id: 'unfolded' });
    f.setLayout({ id: 'folded' });
    f.renderNow();
    const i = f.stage.renderer.info;
    return { g: i.memory.geometries, t: i.memory.textures, p: i.programs.length };
  });
  const first = await mem();
  let last = first;
  for (let i = 0; i < 9; i++) last = await mem();
  expect(Math.abs(last.g - first.g), 'геометрии').toBeLessThanOrEqual(2);
  expect(Math.abs(last.t - first.t), 'текстуры').toBeLessThanOrEqual(2);
  expect(Math.abs(last.p - first.p), 'шейдерные программы').toBeLessThanOrEqual(2);

  // Режим «чертёж»: меши hall и rigging получают материалы чертежа и возвращают исходные
  const bp = await page.evaluate(() => {
    const f = window.__fest;
    f.flag('blueprint', true);
    f.setLayout({ id: 'unfolded' });
    const meshes = [];
    for (const grp of [f.stage.layerGroups.hall, f.stage.layerGroups.rigging]) {
      grp.traverse((o) => { if (o.isMesh && o.type !== 'LineSegments' && o.material.visible !== false) meshes.push(o); });
    }
    const on = meshes.every((m) => m.userData.matOrig && m.material !== m.userData.matOrig);
    f.flag('blueprint', false);
    const off = meshes.every((m) => m.material === m.userData.matOrig);
    return { n: meshes.length, on, off };
  });
  expect(bp.n).toBeGreaterThan(2);
  expect(bp.on).toBe(true);
  expect(bp.off).toBe(true);

  // Пятно прибора при наведении на зону блитчера поднимается на ярус в unfolded и ложится на пол в folded
  const poolHeights = await page.evaluate(() => {
    const f = window.__fest, fx = f.stage.fixtures, it = fx.byNo.get('4');
    const savedAim = { ...it.aim };
    it.aim = { x: 0, y: 0, d: -6.50 };
    f.light('all', true);
    f.setLayout({ id: 'folded' });
    const m = new f.stage.camera.matrixWorld.constructor();
    fx.pools.getMatrixAt(it.idx, m);
    const yFold = m.elements[13];
    f.setLayout({ id: 'unfolded' });
    fx.pools.getMatrixAt(it.idx, m);
    const yUnf = m.elements[13];
    it.aim = savedAim;
    fx.updateAll();
    return { yFold, yUnf };
  });
  expect(poolHeights.yFold).toBeCloseTo(0.012, 2);
  expect(poolHeights.yUnf).toBeCloseTo(0.912, 2);

  // Захват рамы за все 4 стороны, отключение слоя rigging и приоритет выбора прибора № 6
  const pickCheck = await page.evaluate(() => {
    const st = window.__fest.stage;
    window.__fest.setView('plan');
    window.__fest.setHeight('MF', 3.0);
    window.__fest.renderNow();
    const ndcOf = (x, y, d) => {
      const v = new st.camera.position.constructor(x, y, -d).project(st.camera);
      return { x: v.x, y: v.y };
    };
    const sides = [[-2.05, 0], [2.05, 0], [0, -3.20], [0, 1.80]].map(([x, d]) => st.pick(ndcOf(x, 3.15, d)));
    const fx6 = st.fixtures.byNo.get('6');
    const pickFx6 = st.pick(ndcOf(fx6.mount.x, fx6.mount.y - 0.22, fx6.mount.d));
    window.__fest.layer('rigging', false);
    const hiddenVis = st.layerGroups.rigging.visible;
    const pickWhenHidden = st.pick(ndcOf(-2.05, 3.15, 0));
    window.__fest.layer('rigging', true);
    return { sides: sides.map((h) => h?.id), pickFx6: pickFx6?.kind, hiddenVis, pickWhenHidden };
  });
  expect(pickCheck.sides).toEqual(['MF', 'MF', 'MF', 'MF']);
  expect(pickCheck.pickFx6).toBe('fixture');
  expect(pickCheck.hiddenVis).toBe(false);
  expect(pickCheck.pickWhenHidden).toBeNull();

  // Кнопки экспорта: 4 на десктопе, 2 на телефоне
  const expectedExports = mobile ? ['plan-dxf', 'section-dxf'] : ['plan-dxf', 'section-dxf', '3d-dxf', '3d-glb'];
  const panelIds = await page.evaluate(() => [...document.querySelectorAll('.export-panel [data-export]')].map((b) => b.dataset.export));
  expect(panelIds).toEqual(expectedExports);
  expectNoErrors(log);
});

test('Студия мультимедиа на телефоне: все интерактивные элементы ≥ 44 px', async ({ page }, info) => {
  test.skip(!info.project.use.isMobile, 'только телефон');
  const log = await openApp(page, 'mobile.html#v=studio');
  const measure = () => page.evaluate(() => [...document.querySelectorAll('button, [role=button], input, select, summary')]
    .filter((el) => el.offsetParent && el.getClientRects().length && !el.closest('[hidden]'))
    .map((el) => ({ r: el.getBoundingClientRect(), t: (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 30) }))
    .filter(({ r }) => r.width > 0 && Math.min(r.width, r.height) < 44 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)
    .map(({ r, t }) => `${t} (${Math.round(r.width)}×${Math.round(r.height)})`));
  const small = new Set();
  for (const tab of ['rig', 'light', 'hall', 'views', 'layers']) {
    await page.locator(`.mtab[data-tab="${tab}"]`).click();
    if (!(await page.locator('.sheet[data-state=open]').count())) await page.locator(`.mtab[data-tab="${tab}"]`).click();
    await page.evaluate(() => {
      document.querySelectorAll('details.grp').forEach((d, i) => { d.open = i === 0; });
      document.querySelectorAll('details.extra-eq').forEach((d) => { d.open = true; });
    });
    await page.waitForTimeout(250);
    for (const s of await measure()) small.add(`[${tab}] ${s}`);
    const bodyOverflow = await page.evaluate(() => {
      const b = document.querySelector('.sheet-body');
      return b ? b.scrollWidth - b.clientWidth : 0;
    });
    expect(bodyOverflow, `горизонтальное переполнение шторки во вкладке ${tab}`).toBeLessThanOrEqual(0);
  }
  await page.locator('.handle').click();
  await page.evaluate(() => { window.__fest.select({ kind: 'rig', id: 'MF' }); window.__fest.renderNow(); });
  await page.waitForTimeout(200);
  for (const s of await measure()) small.add(`[карточка MF] ${s}`);
  const mfCardClip = await page.evaluate(() => {
    const c = document.querySelector('.card');
    return c ? c.scrollHeight - c.clientHeight : 0;
  });
  expect(mfCardClip, 'карточка MF целиком помещается на телефоне').toBeLessThanOrEqual(2);
  await page.evaluate(() => { window.__fest.selectFixture(1); window.__fest.renderNow(); });
  await page.waitForTimeout(200);
  for (const s of await measure()) small.add(`[карточка №1] ${s}`);
  expect([...small]).toEqual([]);
  expectNoErrors(log);
});

test('фойе: черновик без приборов, слой ткани, переключение и GLB', async ({ page }, info) => {
  const mobile = !!info.project.use.isMobile;
  const log = await openApp(page, `${pageOf(info)}#v=foyer`);
  expect(await page.evaluate(() => window.__fest.venue())).toBe('foyer');
  expect((await canvasStats(page)).std, 'Фойе: кадр не пустой').toBeGreaterThan(4);

  await expect(page.locator('.panel-light [data-id="duty"]')).toHaveCount(1);
  await expect(page.locator('.panel-light')).toContainText('Развес света — в следующей версии');
  await expect(page.locator('.panel-light [data-id="stage"]')).toHaveCount(0);
  await expect(page.locator('.panel-light [data-id="haze"]')).toHaveCount(0);
  await expect(page.locator('.panel-layers [data-id="l-curtain"]')).toHaveCount(1);
  await expect(page.locator('.panel-layers [data-id="l-trusses"]')).toHaveCount(1);
  await expect(page.locator('.panel-layers [data-id="l-lights"]')).toHaveCount(0);
  if (!mobile) await expect(page.locator('.top-search')).toBeHidden();

  const glbBytes = await page.evaluate(async () => (await window.__fest.exportGLB()).byteLength);
  expect(glbBytes).toBeGreaterThan(1000);

  await page.evaluate(() => window.__fest.loadVenue('big'));
  await expect(page.locator('.panel-light [data-id="stage"]')).toHaveCount(1);
  expectNoErrors(log);
});

